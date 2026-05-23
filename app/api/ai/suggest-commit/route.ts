import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { added, modified, deleted, diff } = body;

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
