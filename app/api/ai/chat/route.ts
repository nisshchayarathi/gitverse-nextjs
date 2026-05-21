import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { repositoryId, question, conversationHistory, prompt } = body;

    // Free-form mode: client provides a prebuilt prompt.
    if (typeof prompt === "string" && prompt.trim()) {
      const response = await getGeminiService().chatRaw(prompt);
      return NextResponse.json({ response });
    }

    if (prompt !== undefined && typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt must be a string" },
        { status: 400 }
      );
    }

    if (repositoryId == null || question == null) {
      return NextResponse.json(
        { error: "Repository ID and question are required" },
        { status: 400 }
      );
    }

    const parsedRepoId = Number(repositoryId);
    if (!Number.isFinite(parsedRepoId)) {
      return NextResponse.json(
        { error: "Repository ID must be a valid number" },
        { status: 400 }
      );
    }

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question must be a non-empty string" },
        { status: 400 }
      );
    }

    if (
      conversationHistory !== undefined &&
      (!Array.isArray(conversationHistory) ||
        conversationHistory.some(
          (m: any) =>
            typeof m !== "object" ||
            !["user", "assistant"].includes(m.role) ||
            typeof m.content !== "string"
        ))
    ) {
      return NextResponse.json(
        { error: "conversationHistory must be an array of {role, content} objects" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.getRepository(
      parsedRepoId,
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
      repositoryId: parsedRepoId,
      question,
      conversationHistory,
      context,
    });

    return NextResponse.json({ response, question });
  } catch (error: any) {
    console.error("AI chat error:", error);

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
