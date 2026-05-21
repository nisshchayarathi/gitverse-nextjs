import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { repositoryId, type } = body;

    if (repositoryId == null || type == null) {
      return NextResponse.json(
        { error: "Repository ID and analysis type are required" },
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

    const validTypes = ["overview", "code-quality", "security", "architecture", "suggestions"];
    if (typeof type !== "string" || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Analysis type must be one of: ${validTypes.join(", ")}` },
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
      languages: repository.languages.map((l: any) => ({
        name: l.name,
        percentage: l.percentage,
      })),
      contributors: repository.contributors.map((c: any) => ({
        name: c.name,
        commits: c.commits,
      })),
      commits: repository.commits.slice(0, 10).map((c: any) => ({
        message: c.message,
        author: c.authorName,
        date: c.committedAt.toISOString(),
      })),
    };

    const analysis = await getGeminiService().analyzeRepository({
      repositoryId: parsedRepoId,
      type: type as "overview" | "code-quality" | "security" | "architecture" | "suggestions",
      context,
    });

    return NextResponse.json({ analysis, type });
  } catch (error: any) {
    console.error("Repository analysis error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to analyze repository" },
      { status: 500 }
    );
  }
}
