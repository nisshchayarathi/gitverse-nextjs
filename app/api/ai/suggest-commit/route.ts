import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { createRateLimiter } from "@/lib/utils/ipRateLimit";
import {
  validateContentType,
  AI_REQUEST_LIMITS,
} from "@/lib/utils/aiRequestValidation";

const commitSuggestionLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

function validateArrayField(
  items: unknown,
  label: string
): NextResponse | null {
  if (!Array.isArray(items)) return null;
  if (items.length > AI_REQUEST_LIMITS.MAX_ARRAY_ITEMS) {
    return NextResponse.json(
      {
        error: `${label} too many items (max ${AI_REQUEST_LIMITS.MAX_ARRAY_ITEMS})`,
      },
      { status: 400 }
    );
  }
  for (const item of items) {
    if (typeof item === "string" && item.length > AI_REQUEST_LIMITS.MAX_ARRAY_ITEM_CHARS) {
      return NextResponse.json(
        {
          error: `${label} item too long (max ${AI_REQUEST_LIMITS.MAX_ARRAY_ITEM_CHARS} characters)`,
        },
        { status: 400 }
      );
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!commitSuggestionLimiter.check(String(user.userId))) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before retrying." },
        { status: 429 }
      );
    }

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const { added, modified, deleted, diff } = body;

    if (diff && typeof diff === "string" && diff.length > AI_REQUEST_LIMITS.MAX_DIFF_CHARS) {
      return NextResponse.json(
        {
          error: `Diff too large (max ${AI_REQUEST_LIMITS.MAX_DIFF_CHARS} characters)`,
        },
        { status: 400 }
      );
    }

    const arrayError =
      validateArrayField(added, "added") ??
      validateArrayField(modified, "modified") ??
      validateArrayField(deleted, "deleted");
    if (arrayError) return arrayError;

    if (
      (!added || added.length === 0) &&
      (!modified || modified.length === 0) &&
      (!deleted || deleted.length === 0) &&
      !diff
    ) {
      return NextResponse.json(
        { error: "At least one of added, modified, deleted, or diff is required" },
        { status: 400 }
      );
    }

    const suggestions = await getGeminiService().suggestCommitMessage({
      added: added || [],
      modified: modified || [],
      deleted: deleted || [],
      diff,
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("Commit suggestion error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
