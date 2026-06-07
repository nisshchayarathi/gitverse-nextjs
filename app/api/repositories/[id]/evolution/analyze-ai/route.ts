import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { getGeminiService } from "@/lib/services/geminiService";
import {
  hashGeminiPromptSeed,
  setGeminiAnalysisCache,
} from "@/lib/services/geminiAnalysisCacheService";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const repositoryId = parseInt(params.id);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    // 1. Verify repository ownership and status
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, userId: user.userId },
      select: { id: true, name: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    // 2. Fetch architecture snapshots for prompt context
    const snapshots = await prisma.architectureSnapshot.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "asc" },
    });

    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: "No repository snapshots found. Please complete the initial repository analysis first." },
        { status: 400, headers: securityHeaders }
      );
    }

    // 3. Fetch commits to compute top co-changes for the prompt
    const commits = await prisma.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      take: 200,
      include: {
        fileChanges: {
          select: {
            path: true,
          },
        },
      },
    });

    const commitCounts: Record<string, number> = {};
    const coChangeCounts: Record<string, Record<string, number>> = {};

    const validCommits = commits.filter(
      (c) => c.fileChanges.length > 1 && c.fileChanges.length <= 15
    );

    for (const commit of validCommits) {
      const paths = Array.from(new Set(commit.fileChanges.map((fc) => fc.path)));

      for (const p of paths) {
        commitCounts[p] = (commitCounts[p] || 0) + 1;
      }

      for (let i = 0; i < paths.length; i++) {
        const fileA = paths[i];
        if (!coChangeCounts[fileA]) {
          coChangeCounts[fileA] = {};
        }

        for (let j = i + 1; j < paths.length; j++) {
          const fileB = paths[j];
          if (!coChangeCounts[fileB]) {
            coChangeCounts[fileB] = {};
          }

          coChangeCounts[fileA][fileB] = (coChangeCounts[fileA][fileB] || 0) + 1;
          coChangeCounts[fileB][fileA] = (coChangeCounts[fileB][fileA] || 0) + 1;
        }
      }
    }

    const couplingPairs: Array<{
      fileA: string;
      fileB: string;
      coChanges: number;
      strength: number;
    }> = [];

    const fileList = Object.keys(commitCounts);
    for (let i = 0; i < fileList.length; i++) {
      const fileA = fileList[i];
      const neighbors = coChangeCounts[fileA] || {};

      for (const fileB of Object.keys(neighbors)) {
        if (fileA < fileB) {
          const coChanges = neighbors[fileB];
          const totalCommitsA = commitCounts[fileA];
          const totalCommitsB = commitCounts[fileB];
          const strength = coChanges / (totalCommitsA + totalCommitsB - coChanges);

          couplingPairs.push({
            fileA,
            fileB,
            coChanges,
            strength,
          });
        }
      }
    }

    const topCouplingPairs = couplingPairs
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);

    // 4. Generate AI Insights via Gemini
    const latestSnapshot = snapshots[snapshots.length - 1];
    const commitHash = latestSnapshot.commitHash;

    const snapshotsStr = snapshots
      .map((s) => {
        const meta = s.metadata as any;
        const totalFiles = meta?.totalFiles || 0;
        const totalLines = meta?.totalLines || 0;
        const totalSize = meta?.totalSize || 0;
        const langs = meta?.languages || [];
        const langsStr = langs
          .map((l: any) => `${l.name} (${Math.round(l.percentage)}%)`)
          .join(", ");

        return `- Commit ${s.commitHash.substring(0, 7)} (${s.tagName ? `Tag: ${s.tagName}` : "Sample"}) on ${new Date(s.committedAt).toLocaleDateString()}:
  Files: ${totalFiles}, Lines of Code: ${totalLines}, Size: ${Math.round(totalSize / 1024)} KB
  Languages: ${langsStr || "None detected"}`;
      })
      .join("\n");

    const couplingStr =
      topCouplingPairs.length > 0
        ? topCouplingPairs
            .map(
              (p) =>
                `- ${p.fileA} ↔ ${p.fileB} (Coupling strength: ${Math.round(p.strength * 100)}%, Co-changes: ${p.coChanges})`
            )
            .join("\n")
        : "No significant co-change coupling detected (repository has few commits or mostly single-file changes).";

    const prompt = `
You are an expert software architect analyzing the evolution and structure of the repository: "${repository.name}".

Here is the temporal repository evolution data (snapshots at key milestones):
${snapshotsStr}

Here are the top logical (co-change) coupling pairs in the repository (how often these files change together in commits, indicating tight coupling):
${couplingStr}

Based on this historical data, please generate a detailed, professional architectural evolution analysis and report. Provide your analysis in clean Markdown. Include the following sections:

1. **Architectural Evolution Summary**: Summarize the growth of the repository, key phases of development, and changes in the language distribution and codebase size over time.
2. **Modularization & Refactoring Recommendations**: Direct suggestions on how to decouple tightly-coupled files/folders, split modules, or extract shared utilities/hooks.
3. **Bottleneck & Coupling Risk Analysis**: Identify modules that are at risk of architectural drift, have high Jaccard coupling, or act as logical bottlenecks.
4. **Actionable Technical Debt Plan**: Prioritized recommendations (High/Medium/Low impact) to address the identified architectural debt.

Avoid generic advice; make your recommendations specific to the files and directories listed above. Do not include any preamble or extra text, begin directly with the report.
`;

    const gemini = getGeminiService();
    const { text: resultText } = await gemini.chatRaw(prompt);

    // 5. Store in GeminiAnalysisCache
    const promptSeed = `architecture_evolution_analysis_${repositoryId}_${commitHash}`;
    const promptHash = hashGeminiPromptSeed({
      repositoryId,
      commitHash,
      analysisType: "architecture_evolution",
      promptSeed,
    });

    await setGeminiAnalysisCache(
      { repositoryId, commitHash, analysisType: "architecture_evolution", promptHash },
      resultText,
      { model: "gemini-2.5-flash" }
    );

    return NextResponse.json(
      { aiInsights: resultText },
      { headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Evolution AI analysis generation error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate architecture evolution insights" },
      { status: 500, headers: securityHeaders }
    );
  }
}
