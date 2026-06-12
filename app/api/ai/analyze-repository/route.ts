import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import prisma from "@/lib/prisma";
import {
  getGeminiAnalysisCache,
  setGeminiAnalysisCache,
} from "@/lib/services/geminiAnalysisCacheService";
import { buildCacheKey } from "@/lib/utils/cacheKey";
import { buildTreeFromFiles, truncateTree, stringifyTree, estimateTokens } from "@/lib/utils/tokenLimits";
import { validateContentType } from "@/lib/utils/aiRequestValidation";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

const CURRENT_MODEL_VERSION = "gemini-2.5-flash";
const MAX_CONTEXT_COMMITS = 25;
const MIN_CONTEXT_COMMITS = 5;


export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const globalRl = await checkRateLimit(String(user.userId), RATE_LIMITS.AI_GLOBAL);
    if (!globalRl.allowed) return rateLimitResponse(globalRl);

    const contentTypeError = validateContentType(request);
    if (contentTypeError) return contentTypeError;

    const body = await request.json();
    const { type, scope } = body;
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

    const flatFiles = (repository as any).files || [];
    const fileTree = buildTreeFromFiles(flatFiles);

    const SAFE_TOKEN_LIMIT = 8000;
    const { truncatedTree, isTruncated } = truncateTree(fileTree, SAFE_TOKEN_LIMIT);
    const stringifiedTree = stringifyTree(truncatedTree);

    const analysisScope = typeof scope === "string" && scope.length > 0 ? scope : "full";

    const treeTokens = estimateTokens(stringifiedTree);
    const TOTAL_BUDGET = 10000;
    const remainingTokens = TOTAL_BUDGET - treeTokens;
    const ESTIMATED_TOKENS_PER_COMMIT = 30;

    const dynamicCommitLimit = Math.max(
      MIN_CONTEXT_COMMITS,
      Math.min(
        MAX_CONTEXT_COMMITS,
        Math.floor(remainingTokens / ESTIMATED_TOKENS_PER_COMMIT)
      )
    );

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
      commits: repository.commits.slice(0, dynamicCommitLimit).map((c: any) => ({
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

    const cacheKey = buildCacheKey({
      repositoryId,
      commitHash,
      analysisType: type,
      modelVersion: CURRENT_MODEL_VERSION,
      analysisScope,
      context,
    });

    const cached = await getGeminiAnalysisCache(cacheKey);

    if (cached.hit && cached.result != null) {
      return NextResponse.json({ analysis: cached.result, type, cached: true, isTruncated });
    }

    const analysis = await getGeminiService().analyzeRepository({
      repositoryId,
      type,
      context,
    });

    await setGeminiAnalysisCache(cacheKey, analysis);

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
