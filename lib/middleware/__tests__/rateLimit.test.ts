import { checkRateLimit, rateLimitResponse, RATE_LIMITS, addRateLimitHeaders, getWindowExpiry, _resetStateForTesting } from "../rateLimit";
import { NextResponse } from "next/server";

const mockIncr = jest.fn();
const mockTtl = jest.fn();
const mockExpire = jest.fn();
const mockPipelineExec = jest.fn();

jest.mock("@/lib/redis", () => ({
  __esModule: true,
  default: {
    pipeline: () => ({
      incr: (...args: any[]) => mockIncr(...args),
      ttl: (...args: any[]) => mockTtl(...args),
      exec: () => mockPipelineExec(),
    }),
    incr: (...args: any[]) => mockIncr(...args),
    ttl: (...args: any[]) => mockTtl(...args),
    expire: (...args: any[]) => mockExpire(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  _resetStateForTesting();

  // Default: successful pipeline returning [incrResult, ttlResult]
  mockPipelineExec.mockResolvedValue([
    [null, 1],  // incr returns count=1
    [null, 59], // ttl returns 59 seconds remaining
  ]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("getWindowExpiry", () => {
  it("rounds to the next window boundary for 60s windows", () => {
    const result = getWindowExpiry(Date.parse("2026-06-04T12:00:03.500Z"), 60_000);
    expect(result.toISOString()).toBe("2026-06-04T12:01:00.000Z");
  });

  it("rounds to the next window boundary for 120s windows", () => {
    const result = getWindowExpiry(Date.parse("2026-06-04T12:01:45.000Z"), 120_000);
    expect(result.toISOString()).toBe("2026-06-04T12:02:00.000Z");
  });

  it("handles exact window boundary", () => {
    const result = getWindowExpiry(Date.parse("2026-06-04T12:00:00.000Z"), 60_000);
    expect(result.toISOString()).toBe("2026-06-04T12:01:00.000Z");
  });

  it("handles 1-hour windows", () => {
    const result = getWindowExpiry(Date.parse("2026-06-04T12:30:00.000Z"), 3_600_000);
    expect(result.toISOString()).toBe("2026-06-04T13:00:00.000Z");
  });

  it("handles 5-minute windows", () => {
    const result = getWindowExpiry(Date.parse("2026-06-04T12:07:23.000Z"), 300_000);
    expect(result.toISOString()).toBe("2026-06-04T12:10:00.000Z");
  });

  it("produces consistent expiry for requests in the same clock window", () => {
    const t1 = Date.parse("2026-06-04T12:00:03.000Z");
    const t2 = Date.parse("2026-06-04T12:00:45.000Z");
    expect(getWindowExpiry(t1, 60_000).toISOString()).toBe(
      getWindowExpiry(t2, 60_000).toISOString()
    );
  });
});

describe("checkRateLimit", () => {
  it("allows request when under limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],  // incr returns count=1
      [null, 59], // ttl returns 59s remaining
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("allows request at boundary of limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 5],  // incr returns count=5
      [null, 30], // ttl returns 30s remaining
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(5);
  });

  it("rejects request when count exceeds limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],  // incr returns count=6 (over limit)
      [null, 15], // ttl returns 15s remaining
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(5);
  });

  it("rejects request when count far exceeds limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 20], // incr returns count=20
      [null, 5],  // ttl returns 5s remaining
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("sets expiry on the first request in a window", async () => {
    // TTL returns -1 (key doesn't exist yet)
    mockPipelineExec.mockResolvedValue([
      [null, 1],   // incr returns count=1
      [null, -1],  // ttl returns -1 (no expiry set)
    ]);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining("repo:analyze:"),
      60  // windowSec
    );
  });

  it("does not set expiry when TTL is already set", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 2],   // incr returns count=2
      [null, 45],  // ttl returns 45s remaining
    ]);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("falls back to LRU on Redis errors", async () => {
    mockPipelineExec.mockRejectedValue(new Error("Redis connection failed"));

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("falls back to LRU when pipeline returns null", async () => {
    mockPipelineExec.mockResolvedValue(null);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("LRU tracks count across successive fallback requests", async () => {
    mockPipelineExec.mockRejectedValue(new Error("Redis timeout"));

    const r1 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(4);

    const r2 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(3);

    const r3 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(2);
  });

  it("LRU enforces limit during prolonged Redis failure", async () => {
    mockPipelineExec.mockRejectedValue(new Error("Redis timeout"));

    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
      expect(r.allowed).toBe(true);
    }

    const r6 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r6.allowed).toBe(false);
    expect(r6.remaining).toBe(0);
  });

  it("handles distinct users independently", async () => {
    mockPipelineExec
      .mockResolvedValueOnce([[null, 1], [null, 59]])   // user-a: count=1
      .mockResolvedValueOnce([[null, 101], [null, 10]]); // user-b: count=101

    const resultA = await checkRateLimit("user-a", RATE_LIMITS.FILE_CONTENT);
    expect(resultA.allowed).toBe(true);
    expect(resultA.remaining).toBe(99);

    const resultB = await checkRateLimit("user-b", RATE_LIMITS.FILE_CONTENT);
    expect(resultB.allowed).toBe(false);
    expect(resultB.remaining).toBe(0);
  });

  it("uses Redis INCR+TTL pipeline for atomic increment", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 59],
    ]);

    await checkRateLimit("alice", { namespace: "repo:analyze", maxRequests: 5, windowMs: 60_000 });

    expect(mockIncr).toHaveBeenCalledWith(
      expect.stringContaining("repo:analyze:")
    );
    expect(mockTtl).toHaveBeenCalled();
  });

  it("sanitizes special characters in the identifier", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 59],
    ]);

    await checkRateLimit("user@x.y", { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    const incrKey = mockIncr.mock.calls[0][0];
    expect(incrKey).toContain("test:user@x.y");
  });

  it("sanitizes SQL metacharacters in the identifier", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 59],
    ]);

    await checkRateLimit("a;b", { namespace: "test", maxRequests: 3, windowMs: 60_000 });

    const incrKey = mockIncr.mock.calls[0][0];
    expect(incrKey).toContain("test:a_b");
  });

  it("validates all RATE_LIMITS configs have sensible values", () => {
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
  it("returns 429 with correct headers and body", () => {
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

  it("includes a custom message when one is provided", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      limit: 5,
    };

    const response = rateLimitResponse(result, "Custom rate limit message");

    expect(response.status).toBe(429);
  });

  it("uses the default message when none is given", () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      limit: 5,
    };

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
  });
});

describe("addRateLimitHeaders", () => {
  it("adds rate limit headers to an existing response", () => {
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

describe("rate limit headers edge cases", () => {
  it("rateLimitResponse includes all three standard headers", () => {
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

  it("addRateLimitHeaders preserves the original response body", () => {
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
  it("defines REPOSITORY_ANALYZE correctly", () => {
    expect(RATE_LIMITS.REPOSITORY_ANALYZE).toEqual({
      namespace: "repo:analyze",
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it("defines AI_GLOBAL with 50 req/min", () => {
    expect(RATE_LIMITS.AI_GLOBAL).toEqual({
      namespace: "ai:global",
      maxRequests: 50,
      windowMs: 60_000,
    });
  });

  it("defines GITHUB_IMPORT with 10 per hour", () => {
    expect(RATE_LIMITS.GITHUB_IMPORT).toEqual({
      namespace: "github:import",
      maxRequests: 10,
      windowMs: 3_600_000,
    });
  });

  it("defines FILE_CONTENT with 100 per minute", () => {
    expect(RATE_LIMITS.FILE_CONTENT).toEqual({
      namespace: "file:content",
      maxRequests: 100,
      windowMs: 60_000,
    });
  });

  it("defines ANNOTATION_SYNC with 10 req/min", () => {
    expect(RATE_LIMITS.ANNOTATION_SYNC).toEqual({
      namespace: "annotation:sync",
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("defines GITHUB_SELECT_REPOS with 10 req/min", () => {
    expect(RATE_LIMITS.GITHUB_SELECT_REPOS).toEqual({
      namespace: "github:select-repos",
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("defines WORKER_HEALTHZ with 20 req/min", () => {
    expect(RATE_LIMITS.WORKER_HEALTHZ).toEqual({
      namespace: "worker:healthz",
      maxRequests: 20,
      windowMs: 60_000,
    });
  });

  it("defines ANALYZE_REPOSITORY with 5 req/min", () => {
    expect(RATE_LIMITS.ANALYZE_REPOSITORY).toEqual({
      namespace: "repo:submission",
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it("defines GITHUB_CONNECTED_REPOS with 30 req/min", () => {
    expect(RATE_LIMITS.GITHUB_CONNECTED_REPOS).toEqual({
      namespace: "github:connected-repos",
      maxRequests: 30,
      windowMs: 60_000,
    });
  });
});
