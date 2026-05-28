import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import { createRateLimiter } from "@/lib/utils/ipRateLimit";
import {
  validateContentType,
  AI_REQUEST_LIMITS,
} from "@/lib/utils/aiRequestValidation";

// Rate limiter: 20 requests per user per minute across all AI chat calls.
// Prevents a single authenticated user from burning Gemini quota unchecked.
const aiChatLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

// Allowed roles in the conversation history. Rejecting "system" entries from
// client payloads prevents prompt injection via injected context.
const ALLOWED_MESSAGE_ROLES = new Set(["user", "model"]);

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Per-user rate limiting
    if (!aiChatLimiter.check(user.userId)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        { status: 429 }
      );
    }

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const { repositoryId, question, conversationHistory } = body;

    // Validate conversationHistory if provided.
    // Only "user" and "model" roles are accepted to prevent system-role injection.
    if (conversationHistory !== undefined) {
      if (!Array.isArray(conversationHistory)) {
        return NextResponse.json(
          { error: "conversationHistory must be an array" },
          { status: 400 }
        );
      }
      if (conversationHistory.length > AI_REQUEST_LIMITS.MAX_CONVERSATION_HISTORY_COUNT) {
        return NextResponse.json(
          {
            error: `Too many conversation history entries (max ${AI_REQUEST_LIMITS.MAX_CONVERSATION_HISTORY_COUNT})`,
          },
          { status: 400 }
        );
      }
      for (const msg of conversationHistory) {
        if (
          !msg ||
          typeof msg !== "object" ||
          typeof msg.role !== "string" ||
          !ALLOWED_MESSAGE_ROLES.has(msg.role) ||
          typeof msg.content !== "string" ||
          !msg.content.trim()
        ) {
          return NextResponse.json(
            {
              error:
                "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string",
            },
            { status: 400 }
          );
        }
        if (msg.content.length > AI_REQUEST_LIMITS.MAX_MESSAGE_CONTENT_CHARS) {
          return NextResponse.json(
            {
              error: `Message content too long (max ${AI_REQUEST_LIMITS.MAX_MESSAGE_CONTENT_CHARS} characters)`,
            },
            { status: 400 }
          );
        }
      }
    }

    // All AI chat requests must supply a repositoryId so the ownership check
    // below runs for every call. The previous free-form prompt path that
    // bypassed this check has been removed.
    if (!repositoryId || !question) {
      return NextResponse.json(
        { error: "repositoryId and question are required" },
        { status: 400 }
      );
    }

    if (typeof question === "string" && question.length > AI_REQUEST_LIMITS.MAX_QUESTION_CHARS) {
      return NextResponse.json(
        {
          error: `Question too long (max ${AI_REQUEST_LIMITS.MAX_QUESTION_CHARS} characters)`,
        },
        { status: 400 }
      );
    }

    // Ownership check: getRepository returns null if the repository does not
    // belong to the requesting user, so unauthorized access returns 404.
    const repository = await repositoryService.getRepository(
      repositoryId,
      user.userId
    );

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const context = {
      files: repository.files.slice(0, 20).map((f: { path: string }) => f.path),
      recentCommits: repository.commits
        .slice(0, 5)
        .map(
          (c: { shortHash: string; message: string }) =>
            `${c.shortHash}: ${c.message}`
        ),
      contributors: repository.contributors.map(
        (c: { name: string }) => c.name
      ),
    };

    const response = await getGeminiService().chatAboutRepository({
      repositoryId,
      question,
      conversationHistory,
      context,
    });

    return NextResponse.json({ response, question });
  } catch (error: any) {
    console.error("AI chat error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
