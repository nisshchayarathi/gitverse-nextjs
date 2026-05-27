import crypto from "crypto";
import prisma from "@/lib/prisma";

type GeminiCacheKey = {
  repositoryId: number;
  commitHash: string;
  analysisType: string;
  promptHash: string;
};

function getCacheTtlMs(): number {
  const raw = process.env.GEMINI_ANALYSIS_CACHE_TTL_SECONDS;
  const ttlSeconds = raw == null ? 7 * 24 * 60 * 60 : Number(raw);

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return 0;
  }

  return Math.floor(ttlSeconds * 1000);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function hashGeminiPromptSeed(seed: unknown): string {
  const payload = stableStringify(seed);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function getGeminiAnalysisCache(
  key: GeminiCacheKey,
): Promise<{ hit: boolean; result: string | null }> {
  const ttlMs = getCacheTtlMs();
  if (ttlMs === 0) return { hit: false, result: null };

  const now = new Date();

  const row = await prisma.geminiAnalysisCache.findUnique({
    where: {
      repositoryId_commitHash_analysisType_promptHash: {
        repositoryId: key.repositoryId,
        commitHash: key.commitHash,
        analysisType: key.analysisType,
        promptHash: key.promptHash,
      },
    },
  });

  if (!row) return { hit: false, result: null };

  if (row.expiresAt && row.expiresAt <= now) {
    return { hit: false, result: null };
  }

  // Best-effort update; do not block on this.
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
  meta?: { model?: string | null },
): Promise<void> {
  const ttlMs = getCacheTtlMs();
  if (ttlMs === 0) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await prisma.geminiAnalysisCache.upsert({
    where: {
      repositoryId_commitHash_analysisType_promptHash: {
        repositoryId: key.repositoryId,
        commitHash: key.commitHash,
        analysisType: key.analysisType,
        promptHash: key.promptHash,
      },
    },
    create: {
      repositoryId: key.repositoryId,
      commitHash: key.commitHash,
      analysisType: key.analysisType,
      promptHash: key.promptHash,
      model: meta?.model ?? null,
      cachedResult: result,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
    },
    update: {
      model: meta?.model ?? undefined,
      cachedResult: result,
      lastAccessedAt: now,
      expiresAt,
    },
  });
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

