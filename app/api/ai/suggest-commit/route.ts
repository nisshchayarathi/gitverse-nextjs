import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { added, modified, deleted, diff } = body;

    const hasValidInput =
      (Array.isArray(added) && added.length > 0) ||
      (Array.isArray(modified) && modified.length > 0) ||
      (Array.isArray(deleted) && deleted.length > 0) ||
      (typeof diff === "string" && diff.trim().length > 0);

    if (!hasValidInput) {
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
    console.error("Commit suggestion error:", error);

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
