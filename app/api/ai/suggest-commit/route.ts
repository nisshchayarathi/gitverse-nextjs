import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { added, modified, deleted, diff } = body;

    if (added !== undefined && added !== null && (!Array.isArray(added) || added.some((item: any) => typeof item !== "string"))) {
      return NextResponse.json(
        { error: "added must be an array of strings" },
        { status: 400 }
      );
    }

    if (modified !== undefined && modified !== null && (!Array.isArray(modified) || modified.some((item: any) => typeof item !== "string"))) {
      return NextResponse.json(
        { error: "modified must be an array of strings" },
        { status: 400 }
      );
    }

    if (deleted !== undefined && deleted !== null && (!Array.isArray(deleted) || deleted.some((item: any) => typeof item !== "string"))) {
      return NextResponse.json(
        { error: "deleted must be an array of strings" },
        { status: 400 }
      );
    }

    if (diff !== undefined && diff !== null && typeof diff !== "string") {
      return NextResponse.json(
        { error: "diff must be a string" },
        { status: 400 }
      );
    }

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
