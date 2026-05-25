import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    /*
     * Chat request validation: every POST must include a `messages` array.
     * Each entry must be an object with non-empty `role` and `content` strings
     * so downstream handlers never process malformed conversation payloads.
     */
    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages is required and must be an array" },
        { status: 400 }
      );
    }
    for (const message of messages) {
      if (
        !message ||
        typeof message !== "object" ||
        typeof message.role !== "string" ||
        !message.role.trim() ||
        typeof message.content !== "string" ||
        !message.content.trim()
      ) {
        return NextResponse.json(
          { error: "Each message must include role and content" },
          { status: 400 }
        );
      }
    }

    const { repositoryId, question, conversationHistory, prompt } = body;

    // Free-form mode: client provides a prebuilt prompt.
    if (typeof prompt === "string" && prompt.trim()) {
      const response = await getGeminiService().chatRaw(prompt, messages);
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
