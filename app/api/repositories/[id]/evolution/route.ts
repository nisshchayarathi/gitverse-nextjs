import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { getGeminiService } from "@/lib/services/geminiService";
import {
  getGeminiAnalysisCache,
  hashGeminiPromptSeed,
  setGeminiAnalysisCache,
} from "@/lib/services/geminiAnalysisCacheService";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(
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
      select: { id: true, name: true, defaultBranch: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    // 2. Fetch architecture snapshots
    const snapshots = await prisma.architectureSnapshot.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "asc" },
    });

    // 3. Perform Co-Change Coupling Analysis
    // Fetch last 200 commits with file changes
    const commits = await prisma.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      take: 200,
      include: {
        fileChanges: {
          select: {
            path: true,
            changeType: true,
          },
        },
      },
    });

    const commitCounts: Record<string, number> = {};
    const coChangeCounts: Record<string, Record<string, number>> = {};

    // Analyze coupling (ignore large commits > 15 files to filter out boilerplate/noise)
    const validCommits = commits.filter(
      (c) => c.fileChanges.length > 1 && c.fileChanges.length <= 15
    );

    for (const commit of validCommits) {
      const paths = Array.from(new Set(commit.fileChanges.map((fc) => fc.path)));

      // Increment commit counts for each file
      for (const p of paths) {
        commitCounts[p] = (commitCounts[p] || 0) + 1;
      }

      // Increment co-change pairs
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

    // Compute Jaccard similarity coupling strength
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
        // Avoid duplicate pairs A-B and B-A
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

    // Sort by coupling strength and take top 25 pairs
    const topCouplingPairs = couplingPairs
      .sort((a, b) => b.strength - a.strength || b.coChanges - a.coChanges)
      .slice(0, 25);

    // Build coupling matrix for the top 12 most active/coupled files
    const fileCouplingWeights = new Map<string, number>();
    for (const pair of topCouplingPairs) {
      fileCouplingWeights.set(
        pair.fileA,
        (fileCouplingWeights.get(pair.fileA) || 0) + pair.strength
      );
      fileCouplingWeights.set(
        pair.fileB,
        (fileCouplingWeights.get(pair.fileB) || 0) + pair.strength
      );
    }

    const topMatrixFiles = Array.from(fileCouplingWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map((entry) => entry[0]);

    const matrix: number[][] = Array(topMatrixFiles.length)
      .fill(null)
      .map(() => Array(topMatrixFiles.length).fill(0));

    for (let i = 0; i < topMatrixFiles.length; i++) {
      const fileA = topMatrixFiles[i];
      matrix[i][i] = 1.0; // Self-coupling

      for (let j = i + 1; j < topMatrixFiles.length; j++) {
        const fileB = topMatrixFiles[j];
        const strength =
          couplingPairs.find(
            (p) =>
              (p.fileA === fileA && p.fileB === fileB) ||
              (p.fileA === fileB && p.fileB === fileA)
          )?.strength || 0;

        matrix[i][j] = strength;
        matrix[j][i] = strength;
      }
    }

    // 4. Fetch cached AI Insights
    let cachedResult: string | null = null;
    try {
      const latestSnapshot = snapshots[snapshots.length - 1];
      const commitHash = latestSnapshot?.commitHash || "latest";

      // Re-use GeminiAnalysisCache system
      const promptSeed = `architecture_evolution_analysis_${repositoryId}_${commitHash}`;
      const promptHash = hashGeminiPromptSeed({
        repositoryId,
        commitHash,
        analysisType: "architecture_evolution",
        promptSeed,
      });

      const cached = await getGeminiAnalysisCache({
        repositoryId,
        commitHash,
        analysisType: "architecture_evolution",
        promptHash,
      });

      if (cached && cached.hit) {
        cachedResult = cached.result;
      }
    } catch (aiCacheError) {
      console.warn("Failed to check AI analysis cache:", aiCacheError);
    }

    return NextResponse.json(
      {
        snapshots: snapshots.map((s) => ({
          id: s.id,
          commitHash: s.commitHash,
          tagName: s.tagName,
          commitMessage: s.commitMessage,
          committedAt: s.committedAt,
          dependencyGraph: s.dependencyGraph,
          metadata: s.metadata,
        })),
        coupling: {
          topPairs: topCouplingPairs,
          files: topMatrixFiles,
          matrix,
        },
        aiInsights: cachedResult,
      },
      { headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Evolution analysis error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to load repository architecture evolution analytics" },
      { status: 500, headers: securityHeaders }
    );
  }
}
