import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { code, language, analysisType, context } = body;

    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { error: "Code must be a non-empty string" },
        { status: 400 }
      );
    }

    if (typeof language !== "string" || !language.trim()) {
      return NextResponse.json(
        { error: "Language must be a non-empty string" },
        { status: 400 }
      );
    }

    const validAnalysisTypes = ["explain", "improve", "bugs", "document", "refactor"];
    if (typeof analysisType !== "string" || !validAnalysisTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: `Analysis type must be one of: ${validAnalysisTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (code.length > 10000) {
      return NextResponse.json(
        { error: "Code snippet too large (max 10000 characters)" },
        { status: 400 }
      );
    }

    const analysis = await getGeminiService().analyzeCode({
      code,
      language,
      analysisType: analysisType as "explain" | "improve" | "bugs" | "document" | "refactor",
      context,
    });

    return NextResponse.json({ analysis, analysisType });
  } catch (error: any) {
    console.error("Code analysis error:", error);
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
