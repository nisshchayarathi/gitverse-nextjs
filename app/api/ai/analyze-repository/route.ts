import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import prisma from "@/lib/prisma";
import {
  getGeminiAnalysisCache,
  hashGeminiPromptSeed,
  setGeminiAnalysisCache,
} from "@/lib/services/geminiAnalysisCacheService";
import { buildTreeFromFiles, truncateTree, stringifyTree } from "@/lib/utils/tokenLimits";
import { validateContentType } from "@/lib/utils/aiRequestValidation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const { type } = body;
    const repositoryId = Number(body.repositoryId);

    if (!body.repositoryId || isNaN(repositoryId) || !type) {
      return NextResponse.json(
        { error: "Valid Repository ID and analysis type are required" },
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

    // Convert flat files from DB to dynamic tree structure
    const flatFiles = (repository as any).files || [];
    const fileTree = buildTreeFromFiles(flatFiles);

    // Limit tree stringification to 80% of a safe 10,000 token limit (8,000 tokens ≈ 32,000 characters)
    const SAFE_TOKEN_LIMIT = 8000;
    const { truncatedTree, isTruncated } = truncateTree(fileTree, SAFE_TOKEN_LIMIT);
    const stringifiedTree = stringifyTree(truncatedTree);

    const context = {
      targetDirectory: (repository as any).targetDirectory ?? undefined,
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
      fileTree: stringifiedTree,
    };

    const defaultBranch = repository.defaultBranch || "main";
    const headCommit =
      (await prisma.commit.findFirst({
        where: { repositoryId, branch: defaultBranch },
        orderBy: { committedAt: "desc" },
        select: { hash: true },
      })) ?? null;

    const commitHash =
      headCommit?.hash ||
      (repository.commits?.[0] as any)?.hash ||
      "unknown";

    const promptHash = hashGeminiPromptSeed({
      v: 1,
      repositoryId,
      commitHash,
      type,
      context,
    });

    const cached = await getGeminiAnalysisCache({
      repositoryId,
      commitHash,
      analysisType: type,
      promptHash,
    });

    if (cached.hit && cached.result != null) {
      return NextResponse.json({ analysis: cached.result, type, cached: true, isTruncated });
    }

    const analysis = await getGeminiService().analyzeRepository({
      repositoryId,
      type,
      context,
    });

    await setGeminiAnalysisCache(
      { repositoryId, commitHash, analysisType: type, promptHash },
      analysis,
      { model: "gemini-2.5-flash" },
    );

    return NextResponse.json({ analysis, type, cached: false, isTruncated });
  } catch (error: any) {
    console.error("Repository analysis error:", sanitizeError(error));

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
