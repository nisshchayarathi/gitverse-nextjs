import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repositoryId = Number(params.id);

    const repository = await prisma.repository.findUnique({
      where: {
        id: repositoryId,
      },
      include: {
        commits: true,
        files: true,
        contributors: true,
        languages: true,
      },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const totalCommits = repository.commits.length;

    const totalFiles = repository.files.length;

    const totalContributors = repository.contributors.length;

    const languageCount = repository.languages.length;

    const hotspots = repository.files
      .sort((a: any, b: any) => (b.lines || 0) - (a.lines || 0))
      .slice(0, 5)
      .map((file: any) => ({
        name: file.path,
        lines: file.lines || 0,
      }));

    const insights = [
      totalCommits > 200
        ? "Repository shows healthy development activity."
        : "Repository has moderate commit activity.",

      totalFiles > 100
        ? "Large codebase detected with growing architecture."
        : "Small-to-medium repository structure.",

      languageCount > 3
        ? "Polyglot repository with multiple technologies."
        : "Focused technology stack detected.",
    ];

    return NextResponse.json({
      ...repository,
      metrics: {
        totalCommits,
        totalFiles,
        totalContributors,
        languageCount,
      },
      hotspots,
      insights,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to fetch evolution data",
      },
      {
        status: 500,
      }
    );
  }
}