import prisma from "@/lib/prisma";
import { hashGeminiPromptSeed } from "@/lib/utils/cacheKey";

export { hashGeminiPromptSeed };

type GeminiCacheKey = {
  repositoryId: number;
  commitHash: string;
  analysisType: string;
  promptHash: string;
  modelVersion: string;
  analysisScope: string;
};

const MAX_CACHE_ENTRIES_PER_REPO = 500;

function getCacheTtlMs(): number {
  const raw = process.env.GEMINI_ANALYSIS_CACHE_TTL_SECONDS;
  const ttlSeconds = raw == null ? 7 * 24 * 60 * 60 : Number(raw);

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return 0;
  }

  return Math.floor(ttlSeconds * 1000);
}

async function enforceMaxEntries(
  repositoryId: number,
  maxEntries: number = MAX_CACHE_ENTRIES_PER_REPO,
): Promise<void> {
  const count = await prisma.geminiAnalysisCache.count({
    where: { repositoryId },
  });
  if (count < maxEntries) return;

  const stale = await prisma.geminiAnalysisCache.findMany({
    where: { repositoryId },
    orderBy: { lastAccessedAt: "asc" },
    take: count - maxEntries + 1,
    select: { id: true },
  });

  if (stale.length > 0) {
    await prisma.geminiAnalysisCache.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
  }
}

export async function getGeminiAnalysisCache(
  key: GeminiCacheKey,
): Promise<{ hit: boolean; result: string | null }> {
  const ttlMs = getCacheTtlMs();
  if (ttlMs === 0) return { hit: false, result: null };

  const now = new Date();

  const row = await prisma.geminiAnalysisCache.findFirst({
    where: {
      repositoryId: key.repositoryId,
      commitHash: key.commitHash,
      analysisType: key.analysisType,
      promptHash: key.promptHash,
      modelVersion: key.modelVersion,
      analysisScope: key.analysisScope,
    },
  });

  if (!row) return { hit: false, result: null };

  if (row.expiresAt && row.expiresAt <= now) {
    return { hit: false, result: null };
  }

  prisma.geminiAnalysisCache
    .update({
      where: { id: row.id },
      data: { lastAccessedAt: now },
    })
    .catch(() => null);

  return { hit: true, result: row.cachedResult };
}

export async function setGeminiAnalysisCache(
  key: GeminiCacheKey,
  result: string,
): Promise<void> {
  const ttlMs = getCacheTtlMs();
  if (ttlMs === 0) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await enforceMaxEntries(key.repositoryId);

  const existing = await prisma.geminiAnalysisCache.findFirst({
    where: {
      repositoryId: key.repositoryId,
      commitHash: key.commitHash,
      analysisType: key.analysisType,
      promptHash: key.promptHash,
      modelVersion: key.modelVersion,
      analysisScope: key.analysisScope,
    },
  });

  if (existing) {
    await prisma.geminiAnalysisCache.update({
      where: { id: existing.id },
      data: {
        modelVersion: key.modelVersion,
        analysisScope: key.analysisScope,
        cachedResult: result,
        lastAccessedAt: now,
        expiresAt,
      },
    });
  } else {
    await prisma.geminiAnalysisCache.create({
      data: {
        repositoryId: key.repositoryId,
        commitHash: key.commitHash,
        analysisType: key.analysisType,
        promptHash: key.promptHash,
        modelVersion: key.modelVersion,
        analysisScope: key.analysisScope,
        cachedResult: result,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt,
      },
    });
  }
}

export async function invalidateGeminiAnalysisCacheForRepository(
  repositoryId: number,
  keepCommitHash: string,
): Promise<void> {
  await prisma.geminiAnalysisCache.deleteMany({
    where: {
      repositoryId,
      commitHash: { not: keepCommitHash },
    },
  });
}

export async function invalidateCacheForCommit(
  repositoryId: number,
  commitHash: string,
): Promise<number> {
  const result = await prisma.geminiAnalysisCache.deleteMany({
    where: { repositoryId, commitHash },
  });
  return result.count;
}

export async function invalidateCacheForBranch(
  repositoryId: number,
  commitHash: string,
): Promise<number> {
  const result = await prisma.geminiAnalysisCache.deleteMany({
    where: {
      repositoryId,
      commitHash,
    },
  });
  return result.count;
}

export async function invalidateExpiredCacheEntries(
  repositoryId: number,
): Promise<number> {
  const result = await prisma.geminiAnalysisCache.deleteMany({
    where: {
      repositoryId,
      expiresAt: { lte: new Date() },
    },
  });
  return result.count;
}

export async function getCacheEntryCount(
  repositoryId: number,
): Promise<number> {
  return prisma.geminiAnalysisCache.count({ where: { repositoryId } });
}
