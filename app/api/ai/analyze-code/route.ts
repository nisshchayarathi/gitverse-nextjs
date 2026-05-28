import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { createRateLimiter } from "@/lib/utils/ipRateLimit";
import {
  validateContentType,
  AI_REQUEST_LIMITS,
} from "@/lib/utils/aiRequestValidation";

const codeAnalysisLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!codeAnalysisLimiter.check(String(user.userId))) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before retrying." },
        { status: 429 }
      );
    }

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const { code, language, analysisType, context } = body;

    if (!code || !language || !analysisType) {
      return NextResponse.json(
        { error: "Code, language, and analysis type are required" },
        { status: 400 }
      );
    }

    if (code.length > 10000) {
      return NextResponse.json(
        { error: "Code snippet too large (max 10000 characters)" },
        { status: 400 }
      );
    }

    if (context && typeof context === "string" && context.length > AI_REQUEST_LIMITS.MAX_CONTEXT_CHARS) {
      return NextResponse.json(
        {
          error: `Context too long (max ${AI_REQUEST_LIMITS.MAX_CONTEXT_CHARS} characters)`,
        },
        { status: 400 }
      );
    }

    const analysis = await getGeminiService().analyzeCode({
      code,
      language,
      analysisType,
      context,
    });

    return NextResponse.json({ analysis, analysisType });
  } catch (error: any) {
    console.error("Code analysis error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to analyze code" },
      { status: 500 }
    );
  }
}
