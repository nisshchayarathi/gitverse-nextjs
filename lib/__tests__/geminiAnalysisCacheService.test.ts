/**
 * @jest-environment node
 */

var mockPrisma: any;

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: (mockPrisma = {
    geminiAnalysisCache: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  }),
}));

import {
  getGeminiAnalysisCache,
  setGeminiAnalysisCache,
  invalidateCacheForCommit,
  invalidateCacheForBranch,
  invalidateExpiredCacheEntries,
  invalidateGeminiAnalysisCacheForRepository,
  getCacheEntryCount,
} from "../services/geminiAnalysisCacheService";

type AnyMock = jest.Mock;

function asMock(fn: unknown): AnyMock {
  return fn as AnyMock;
}

const cacheKey = {
  repositoryId: 1,
  commitHash: "abc123",
  analysisType: "overview",
  promptHash: "deadbeef",
  modelVersion: "gemini-2.5-flash",
  analysisScope: "full",
};

describe("getGeminiAnalysisCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns miss when TTL is disabled", async () => {
    process.env.GEMINI_ANALYSIS_CACHE_TTL_SECONDS = "0";
    const result = await getGeminiAnalysisCache(cacheKey);
    expect(result.hit).toBe(false);
    expect(result.result).toBeNull();
    delete process.env.GEMINI_ANALYSIS_CACHE_TTL_SECONDS;
  });

  it("returns miss when no row found", async () => {
    asMock(mockPrisma.geminiAnalysisCache.findFirst).mockResolvedValue(null);
    const result = await getGeminiAnalysisCache(cacheKey);
    expect(result.hit).toBe(false);
  });

  it("returns miss when row is expired", async () => {
    asMock(mockPrisma.geminiAnalysisCache.findFirst).mockResolvedValue({
      id: 1,
      cachedResult: "stale",
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await getGeminiAnalysisCache(cacheKey);
    expect(result.hit).toBe(false);
  });

  it("returns hit with cached result", async () => {
    asMock(mockPrisma.geminiAnalysisCache.findFirst).mockResolvedValue({
      id: 1,
      cachedResult: "valid analysis",
      expiresAt: new Date(Date.now() + 3600000),
    });
    const result = await getGeminiAnalysisCache(cacheKey);
    expect(result.hit).toBe(true);
    expect(result.result).toBe("valid analysis");
  });
});

describe("setGeminiAnalysisCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new cache entry when none exists", async () => {
    asMock(mockPrisma.geminiAnalysisCache.count).mockResolvedValue(0);
    asMock(mockPrisma.geminiAnalysisCache.findFirst).mockResolvedValue(null);
    asMock(mockPrisma.geminiAnalysisCache.create).mockResolvedValue({ id: 1 });

    await setGeminiAnalysisCache(cacheKey, "new analysis");

    expect(mockPrisma.geminiAnalysisCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repositoryId: 1,
          commitHash: "abc123",
          analysisType: "overview",
          promptHash: "deadbeef",
          modelVersion: "gemini-2.5-flash",
          analysisScope: "full",
          cachedResult: "new analysis",
        }),
      }),
    );
  });

  it("updates existing cache entry", async () => {
    asMock(mockPrisma.geminiAnalysisCache.count).mockResolvedValue(0);
    asMock(mockPrisma.geminiAnalysisCache.findFirst).mockResolvedValue({ id: 5 });
    asMock(mockPrisma.geminiAnalysisCache.update).mockResolvedValue({ id: 5 });

    await setGeminiAnalysisCache(cacheKey, "updated analysis");

    expect(mockPrisma.geminiAnalysisCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          cachedResult: "updated analysis",
        }),
      }),
    );
  });

  it("enforces max entries per repository", async () => {
    asMock(mockPrisma.geminiAnalysisCache.count).mockResolvedValue(501);
    asMock(mockPrisma.geminiAnalysisCache.findMany).mockResolvedValue(
      Array.from({ length: 2 }, (_, i) => ({ id: i + 1 })),
    );

    await setGeminiAnalysisCache(cacheKey, "analysis");

    expect(mockPrisma.geminiAnalysisCache.deleteMany).toHaveBeenCalled();
  });
});

describe("invalidation functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalidateCacheForCommit deletes entries for specific commit", async () => {
    asMock(mockPrisma.geminiAnalysisCache.deleteMany).mockResolvedValue({ count: 3 });
    const deleted = await invalidateCacheForCommit(1, "abc123");
    expect(deleted).toBe(3);
    expect(mockPrisma.geminiAnalysisCache.deleteMany).toHaveBeenCalledWith({
      where: { repositoryId: 1, commitHash: "abc123" },
    });
  });

  it("invalidateCacheForBranch deletes entries for branch commit", async () => {
    asMock(mockPrisma.geminiAnalysisCache.deleteMany).mockResolvedValue({ count: 2 });
    const deleted = await invalidateCacheForBranch(1, "def456");
    expect(deleted).toBe(2);
  });

  it("invalidateExpiredCacheEntries deletes only expired rows", async () => {
    asMock(mockPrisma.geminiAnalysisCache.deleteMany).mockResolvedValue({ count: 5 });
    const deleted = await invalidateExpiredCacheEntries(1);
    expect(deleted).toBe(5);
    const call = asMock(mockPrisma.geminiAnalysisCache.deleteMany).mock.calls[0][0];
    expect(call.where.repositoryId).toBe(1);
    expect(call.where.expiresAt).toEqual({ lte: expect.any(Date) });
  });

  it("invalidateGeminiAnalysisCacheForRepository keeps specified commit", async () => {
    asMock(mockPrisma.geminiAnalysisCache.deleteMany).mockResolvedValue({ count: 10 });
    await invalidateGeminiAnalysisCacheForRepository(1, "keep-commit");
    const call = asMock(mockPrisma.geminiAnalysisCache.deleteMany).mock.calls[0][0];
    expect(call.where.repositoryId).toBe(1);
    expect(call.where.commitHash).toEqual({ not: "keep-commit" });
  });

  it("getCacheEntryCount returns count for repository", async () => {
    asMock(mockPrisma.geminiAnalysisCache.count).mockResolvedValue(7);
    const count = await getCacheEntryCount(1);
    expect(count).toBe(7);
  });
});
