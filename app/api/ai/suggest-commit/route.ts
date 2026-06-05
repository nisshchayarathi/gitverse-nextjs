import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { getGeminiService } from "@/lib/services/geminiService";
import { checkAiRateLimit, logAiRequest } from "@/lib/utils/ipRateLimit";
import { getClientIp } from "@/lib/services/rateLimitService";
import {
  validateContentType,
  AI_REQUEST_LIMITS,
} from "@/lib/utils/aiRequestValidation";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

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

    const globalRl = await checkRateLimit(String(user.userId), RATE_LIMITS.AI_GLOBAL);
    if (!globalRl.allowed) return rateLimitResponse(globalRl);

    const allowed = await checkAiRateLimit(
      String(user.userId), "userId", "suggest-commit", 20, 60_000
    );
    if (!allowed) {
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

    void logAiRequest({
      userId: user.userId,
      ip: getClientIp(request),
      endpoint: "suggest-commit",
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    logger.error(
      { err: sanitizeError(error), route: "app/api/ai/suggest-commit/route.ts" },
      "Commit suggestion error"
    );

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
