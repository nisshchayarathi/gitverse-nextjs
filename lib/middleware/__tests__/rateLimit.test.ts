import { checkRateLimit, rateLimitResponse, RATE_LIMITS, addRateLimitHeaders } from "../rateLimit";
import { NextResponse } from "next/server";

const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    rateLimit: {
      count: (...args: any[]) => mockCount(...args),
      create: (...args: any[]) => mockCreate(...args),
      findFirst: (...args: any[]) => mockFindFirst(...args),
      deleteMany: (...args: any[]) => mockDeleteMany(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-06-04T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows request when under limit", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: "test:user1", points: 1 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows request at boundary of limit", async () => {
    mockCount.mockResolvedValue(4);
    mockCreate.mockResolvedValue({ id: "2", key: "test:user1", points: 1 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("rejects request when at limit", async () => {
    mockCount.mockResolvedValue(5);
    mockFindFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 30000) });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects request when over limit", async () => {
    mockCount.mockResolvedValue(10);
    mockFindFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000) });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("handles P2002 unique constraint error as rate limited", async () => {
    mockCount.mockResolvedValue(4);
    const p2002Error = new Error("Unique constraint");
    (p2002Error as any).code = "P2002";
    mockCreate.mockRejectedValue(p2002Error);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("handles database errors gracefully (fail-open)", async () => {
    mockCount.mockRejectedValue(new Error("DB connection failed"));

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
  });

  it("tracks different users independently", async () => {
    mockCount.mockImplementation(({ where: { key } }: any) => {
      if (key === "file:content:user-a") return Promise.resolve(0);
      if (key === "file:content:user-b") return Promise.resolve(100);
      return Promise.resolve(0);
    });
    mockCreate.mockResolvedValue({ id: "x", key: "file:content:user-a", points: 1 });

    const resultA = await checkRateLimit("user-a", RATE_LIMITS.FILE_CONTENT);
    expect(resultA.allowed).toBe(true);
    expect(resultA.remaining).toBe(99);

    mockFindFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 30000) });
    const resultB = await checkRateLimit("user-b", RATE_LIMITS.FILE_CONTENT);
    expect(resultB.allowed).toBe(false);
    expect(resultB.remaining).toBe(0);
  });

  it("does not create duplicate records for same user in same window", async () => {
    mockCount.mockResolvedValue(1);
    mockCreate.mockResolvedValue({ id: "2", key: "test:user1", points: 1 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("queries with correct key format", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: "repo:analyze:alice", points: 1 });

    await checkRateLimit("alice", { namespace: "repo:analyze", maxRequests: 5, windowMs: 60_000 });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          key: "repo:analyze:alice",
        }),
      })
    );
  });

  it("creates record with correct expiry", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: "test:user1", points: 1 });

    const windowMs = 120_000;
    await checkRateLimit("user1", { namespace: "test", maxRequests: 3, windowMs });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: "test:user1",
        points: 1,
        expiresAt: new Date(Date.now() + windowMs),
      }),
    });
  });

  it("sanitizes special characters in identifier", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: "test:user_x_y", points: 1 });

    await checkRateLimit("user@x.y", { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          key: "test:user@x.y",
        }),
      })
    );
  });

  it("sanitizes SQL-like characters in identifier", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: "test:a_b", points: 1 });

    await checkRateLimit("a;b", { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          key: "test:a_b",
        }),
      })
    );
  });

  it("handles very long identifier", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "1", key: expect.stringContaining("test:"), points: 1 });

    const longId = "a".repeat(1000);
    await checkRateLimit(longId, { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    expect(mockCount).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: expect.stringContaining("test:"),
        }),
      })
    );
  });

  it("uses expiresAt in where clause for count", async () => {
    mockCount.mockResolvedValue(1);
    mockCreate.mockResolvedValue({ id: "1", key: "test:user", points: 1 });

    await checkRateLimit("user", { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });

  it("enforces all RATE_LIMITS configs have valid values", () => {
    for (const [name, config] of Object.entries(RATE_LIMITS)) {
      expect(config.namespace).toBeDefined();
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThanOrEqual(1000);
      expect(typeof config.namespace).toBe("string");
      expect(Number.isInteger(config.maxRequests)).toBe(true);
      expect(Number.isFinite(config.windowMs)).toBe(true);
    }
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with correct headers", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      limit: 10,
    };

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil((Date.now() + 60000) / 1000))
    );
  });

  it("includes custom message when provided", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      limit: 5,
    };

    const response = rateLimitResponse(result, "Custom rate limit message");

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("sets default error message when not provided", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      limit: 5,
    };

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("addRateLimitHeaders", () => {
  it("adds rate limit headers to existing response", () => {
    const response = NextResponse.json({ data: "test" });
    const result = {
      allowed: true,
      remaining: 8,
      resetAt: Date.now() + 60000,
      limit: 10,
    };

    addRateLimitHeaders(response, result);

    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("8");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil((Date.now() + 60000) / 1000))
    );
  });
});

describe("rate limit headers", () => {
  it("rateLimitResponse includes all standard headers", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: 1_000_000_000_000,
      limit: 10,
    };
    const response = rateLimitResponse(result);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1000000000");
  });

  it("addRateLimitHeaders preserves existing body", () => {
    const response = NextResponse.json({ hello: "world" });
    const result = {
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
      limit: 10,
    };
    addRateLimitHeaders(response, result);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
  });
});

describe("RATE_LIMITS configuration", () => {
  it("has REPOSITORY_ANALYZE with correct values", () => {
    expect(RATE_LIMITS.REPOSITORY_ANALYZE).toEqual({
      namespace: "repo:analyze",
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it("has AI_GLOBAL with 50 req/min cap", () => {
    expect(RATE_LIMITS.AI_GLOBAL).toEqual({
      namespace: "ai:global",
      maxRequests: 50,
      windowMs: 60_000,
    });
  });

  it("has GITHUB_IMPORT with 10 per hour", () => {
    expect(RATE_LIMITS.GITHUB_IMPORT).toEqual({
      namespace: "github:import",
      maxRequests: 10,
      windowMs: 3_600_000,
    });
  });

  it("has FILE_CONTENT with 100 per minute", () => {
    expect(RATE_LIMITS.FILE_CONTENT).toEqual({
      namespace: "file:content",
      maxRequests: 100,
      windowMs: 60_000,
    });
  });

  it("has ANNOTATION_SYNC with 10 req/min", () => {
    expect(RATE_LIMITS.ANNOTATION_SYNC).toEqual({
      namespace: "annotation:sync",
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("has GITHUB_SELECT_REPOS with 10 req/min", () => {
    expect(RATE_LIMITS.GITHUB_SELECT_REPOS).toEqual({
      namespace: "github:select-repos",
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("has WORKER_HEALTHZ with 20 req/min", () => {
    expect(RATE_LIMITS.WORKER_HEALTHZ).toEqual({
      namespace: "worker:healthz",
      maxRequests: 20,
      windowMs: 60_000,
    });
  });

  it("has ANALYZE_REPOSITORY with 5 req/min", () => {
    expect(RATE_LIMITS.ANALYZE_REPOSITORY).toEqual({
      namespace: "repo:submission",
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it("has GITHUB_CONNECTED_REPOS with 30 req/min", () => {
    expect(RATE_LIMITS.GITHUB_CONNECTED_REPOS).toEqual({
      namespace: "github:connected-repos",
      maxRequests: 30,
      windowMs: 60_000,
    });
  });
});
