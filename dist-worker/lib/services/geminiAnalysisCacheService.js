"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashGeminiPromptSeed = hashGeminiPromptSeed;
exports.getGeminiAnalysisCache = getGeminiAnalysisCache;
exports.setGeminiAnalysisCache = setGeminiAnalysisCache;
exports.invalidateGeminiAnalysisCacheForRepository = invalidateGeminiAnalysisCacheForRepository;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
function getCacheTtlMs() {
    const raw = process.env.GEMINI_ANALYSIS_CACHE_TTL_SECONDS;
    const ttlSeconds = raw == null ? 7 * 24 * 60 * 60 : Number(raw);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        return 0;
    }
    return Math.floor(ttlSeconds * 1000);
}
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(",")}}`;
}
function hashGeminiPromptSeed(seed) {
    const payload = stableStringify(seed);
    return crypto_1.default.createHash("sha256").update(payload).digest("hex");
}
async function getGeminiAnalysisCache(key) {
    const ttlMs = getCacheTtlMs();
    if (ttlMs === 0)
        return { hit: false, result: null };
    const now = new Date();
    const row = await prisma_1.default.geminiAnalysisCache.findUnique({
        where: {
            repositoryId_commitHash_analysisType_promptHash: {
                repositoryId: key.repositoryId,
                commitHash: key.commitHash,
                analysisType: key.analysisType,
                promptHash: key.promptHash,
            },
        },
    });
    if (!row)
        return { hit: false, result: null };
    if (row.expiresAt && row.expiresAt <= now) {
        return { hit: false, result: null };
    }
    // Best-effort update; do not block on this.
    prisma_1.default.geminiAnalysisCache
        .update({
        where: { id: row.id },
        data: { lastAccessedAt: now },
    })
        .catch(() => null);
    return { hit: true, result: row.cachedResult };
}
async function setGeminiAnalysisCache(key, result, meta) {
    const ttlMs = getCacheTtlMs();
    if (ttlMs === 0)
        return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await prisma_1.default.geminiAnalysisCache.upsert({
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
async function invalidateGeminiAnalysisCacheForRepository(repositoryId, keepCommitHash) {
    await prisma_1.default.geminiAnalysisCache.deleteMany({
        where: {
            repositoryId,
            commitHash: { not: keepCommitHash },
        },
    });
}
