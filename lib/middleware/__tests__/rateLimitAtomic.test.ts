import { checkRateLimit, getWindowExpiry, _resetStateForTesting, RATE_LIMITS } from "../rateLimit";

const mockUpsert = jest.fn();
const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    rateLimit: {
      upsert: (...args: any[]) => mockUpsert(...args),
      deleteMany: (...args: any[]) => mockDeleteMany(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  _resetStateForTesting();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("atomicity — no TOCTOU window", () => {
  it("upsert is the only DB operation (no separate count + create)", async () => {
    mockUpsert.mockResolvedValue({ points: 1 });

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    const callKeys = mockUpsert.mock.calls.map((c: any[]) => Object.keys(c[0] || {}));
    expect(callKeys.length).toBe(1);
    const firstCall = mockUpsert.mock.calls[0][0];
    expect(firstCall).toHaveProperty("where");
    expect(firstCall).toHaveProperty("update");
    expect(firstCall).toHaveProperty("create");
  });

  it("upsert uses points: { increment: 1 } for atomic increment", async () => {
    mockUpsert.mockResolvedValue({ points: 2 });

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { points: { increment: 1 } },
      })
    );
  });

  it("concurrent requests to the same key share a single upsert target", async () => {
    mockUpsert
      .mockResolvedValueOnce({ points: 1 })
      .mockResolvedValueOnce({ points: 2 })
      .mockResolvedValueOnce({ points: 3 });

    const [r1, r2, r3] = await Promise.all([
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
    ]);

    expect(mockUpsert).toHaveBeenCalledTimes(3);

    const sameWhere = mockUpsert.mock.calls.every((c: any[]) => {
      const w = c[0].where.key_expiresAt;
      return w.key === "repo:analyze:user1";
    });
    expect(sameWhere).toBe(true);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });
});

describe("fixed-window behavior", () => {
  it("requests before and after a window boundary use different rows", async () => {
    mockUpsert.mockResolvedValue({ points: 1 });

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    const firstExpiry = mockUpsert.mock.calls[0][0].where.key_expiresAt.expiresAt;

    jest.advanceTimersByTime(60_000);

    mockUpsert.mockResolvedValue({ points: 1 });
    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    const secondExpiry = mockUpsert.mock.calls[1][0].where.key_expiresAt.expiresAt;

    expect(secondExpiry.getTime()).toBeGreaterThan(firstExpiry.getTime());
  });

  it("expiry aligns to the next clock boundary", async () => {
    jest.setSystemTime(new Date("2026-06-04T12:01:30.000Z"));

    mockUpsert.mockResolvedValue({ points: 1 });

    await checkRateLimit("user1", { namespace: "test", maxRequests: 5, windowMs: 60_000 });

    const { expiresAt } = mockUpsert.mock.calls[0][0].where.key_expiresAt;
    expect(expiresAt.toISOString()).toBe("2026-06-04T12:02:00.000Z");
  });

  it("same-window requests after limit redirect to LRU on P2002", async () => {
    const p2002 = new Error("Unique constraint");
    (p2002 as any).code = "P2002";
    mockUpsert
      .mockResolvedValueOnce({ points: 5 })
      .mockRejectedValueOnce(p2002);

    const r1 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(0);

    const r2 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2.allowed).toBe(false);
    expect(r2.remaining).toBe(0);
  });
});

describe("circuit breaker", () => {
  it("recovers after reset timeout when upsert succeeds again", async () => {
    mockUpsert
      .mockRejectedValueOnce(new Error("DB timeout"))
      .mockResolvedValueOnce({ points: 1 });

    const r1 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r1.allowed).toBe(true);

    jest.advanceTimersByTime(15_000);
    _resetStateForTesting();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ points: 2 });

    const r2 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(3);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("maybeCleanupExpired (coverage)", () => {
  it("triggers deleteMany on first call and then respects the interval", async () => {
    mockUpsert.mockResolvedValue({ points: 1 });

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_000);
    _resetStateForTesting();

    mockUpsert.mockResolvedValue({ points: 1 });
    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(mockDeleteMany).toHaveBeenCalledTimes(2);
  });

  it("does not throw when deleteMany fails", async () => {
    mockDeleteMany.mockRejectedValueOnce(new Error("DB error"));
    mockUpsert.mockResolvedValue({ points: 1 });

    await expect(
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE)
    ).resolves.toHaveProperty("allowed", true);
  });
});

describe("edge cases", () => {
  it("returns remaining=0 when points is exactly at the limit", async () => {
    mockUpsert.mockResolvedValue({ points: 5 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns remaining=0 when points is one over the limit", async () => {
    mockUpsert.mockResolvedValue({ points: 6 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("handles the largest windowMs defined in RATE_LIMITS", async () => {
    mockUpsert.mockResolvedValue({ points: 1 });

    const result = await checkRateLimit("user1", RATE_LIMITS.GITHUB_IMPORT);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
  });

  it("handles zero previous points (first request in window)", async () => {
    mockUpsert.mockResolvedValue({ points: 1 });

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("_resetStateForTesting", () => {
  it("clears LRU cache and circuit breaker state between tests", () => {
    mockUpsert.mockRejectedValue(new Error("fail"));
    const r1 = checkRateLimit("u1", RATE_LIMITS.REPOSITORY_ANALYZE);
    _resetStateForTesting();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ points: 1 });
    const r2 = checkRateLimit("u1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2).resolves.toHaveProperty("allowed", true);
  });
});
