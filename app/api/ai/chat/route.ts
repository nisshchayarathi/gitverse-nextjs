import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { repositoryId, question, conversationHistory, prompt } = body;

    // Free-form mode: client provides a prebuilt prompt.
    if (typeof prompt === "string" && prompt.trim()) {
      // Input size limit
      if (prompt.length > 2000) {
        return NextResponse.json(
          { error: "Prompt exceeds maximum allowed length of 2000 characters" },
          { status: 400 }
        );
      }

      // Block prompt injection patterns
      const blockedPatterns = [
        /ignore (all |previous |above )?instructions/i,
        /system prompt/i,
        /you are now/i,
        /jailbreak/i,
        /forget (all |your |previous )?instructions/i,
      ];

      const isBlocked = blockedPatterns.some((pattern) => pattern.test(prompt));
      if (isBlocked) {
        return NextResponse.json(
          { error: "Prompt contains restricted content" },
          { status: 400 }
        );
      }

      const response = await getGeminiService().chatRaw(prompt);
      return NextResponse.json({ response });
    }

    if (!repositoryId || !question) {
      return NextResponse.json(
        { error: "Repository ID and question are required" },
        { status: 400 }
      );
    }

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
