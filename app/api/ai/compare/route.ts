import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { repositoryIds } = body;

    if (!repositoryIds || !Array.isArray(repositoryIds) || repositoryIds.length < 2) {
      return NextResponse.json(
        { error: "At least two repository IDs are required for comparison" },
        { status: 400 }
      );
    }

    const repositories = [];
    for (const id of repositoryIds) {
      const repoId = Number(id);
      if (isNaN(repoId)) {
        return NextResponse.json(
          { error: `Invalid repository ID: ${id}` },
          { status: 400 }
        );
      }

      const repo = await repositoryService.getRepository(repoId, user.userId);
      if (!repo) {
        return NextResponse.json(
          { error: `Repository not found: ${id}` },
          { status: 404 }
        );
      }
      repositories.push(repo);
    }

    // Build rich architectural summary comparison prompt
    const reposContext = repositories.map((repo, idx) => {
      const langText = repo.languages
        .map((l: any) => `${l.name} (${l.percentage}%)`)
        .join(", ");
      
      const branchText = repo.branches.map((b: any) => b.name).join(", ");
      const commitCount = repo.commits?.length || 0;
      const fileCount = repo.files?.length || 0;
      const contributorCount = repo.contributors?.length || 0;
      
      return `Repository #${idx + 1}: "${repo.name}"
- Description: ${repo.description || "N/A"}
- Tech Stack/Languages: ${langText || "N/A"}
- Stats: ${commitCount} commits, ${contributorCount} contributors, ${fileCount} files, ${repo.branches.length} branches
- Branches: ${branchText || "N/A"}`;
    }).join("\n\n");

    const prompt = `You are a principal software architect assistant.
You are comparing the following repositories side-by-side to help developers understand their architectures, tech stacks, use-cases, and how they relate or compare to each other.

===== REPOSITORIES FOR COMPARISON =====
${reposContext}
======================================

Please generate a professional, high-level comparison and benchmarking report. Use clean Markdown headings and bullet points. Make sure to cover:

1. **High-Level Architectural Comparison**: Compare their primary frameworks, patterns, and overall tech stacks. Identify overlaps or differences (e.g. comparing a frontend vs backend, or two competing libraries).
2. **Primary Use-Cases & Purpose**: Define what each codebase is designed to do and their typical runtime environment or deployment setup.
3. **Codebase Health & Benchmarking**: Contrast their activity levels (commits, files, contributors) and overall complexity.
4. **Architectural Recommendations / Integration potential**: Discuss how these repositories can interact, integrate, or how they compare if choosing between them for a project.

Keep the response comprehensive, deeply architectural, and structured with clear Markdown sections. Do not include any meta-introductions; start directly with the architectural analysis.`;

    const gemini = getGeminiService();
    const comparisonResult = await gemini.chatRaw(prompt);

    return NextResponse.json({ comparison: comparisonResult });
  } catch (error: any) {
    console.error("Repository comparison AI error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate comparison analysis" },
      { status: 500 }
    );
  }
}
