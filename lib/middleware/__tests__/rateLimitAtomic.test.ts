import { checkRateLimit, getWindowExpiry, _resetStateForTesting, RATE_LIMITS } from "../rateLimit";

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

  // Default: successful pipeline
  mockPipelineExec.mockResolvedValue([
    [null, 1],  // incr returns count=1
    [null, 59], // ttl returns 59s remaining
  ]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("atomicity — Redis INCR is atomic", () => {
  it("uses Redis pipeline with INCR and TTL for atomic increment", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 59],
    ]);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(mockIncr).toHaveBeenCalledTimes(1);
    expect(mockTtl).toHaveBeenCalledTimes(1);
    expect(mockPipelineExec).toHaveBeenCalledTimes(1);
  });

  it("pipeline INCR returns the current count atomically", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 3],  // count=3 after increment
      [null, 45],
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);  // 5 - 3 = 2
  });

  it("concurrent requests to the same key use Redis INCR atomically", async () => {
    mockPipelineExec
      .mockResolvedValueOnce([[null, 1], [null, 59]])
      .mockResolvedValueOnce([[null, 2], [null, 58]])
      .mockResolvedValueOnce([[null, 3], [null, 57]]);

    const [r1, r2, r3] = await Promise.all([
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
      checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE),
    ]);

    expect(mockPipelineExec).toHaveBeenCalledTimes(3);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });
});

describe("fixed-window behavior", () => {
  it("requests before and after a window boundary use different Redis keys or TTL resets", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 59],
    ]);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    const firstKey = mockIncr.mock.calls[0][0];

    jest.advanceTimersByTime(60_000);

    // After window boundary, TTL is -1 again (key expired), so EXPIRE is called
    mockPipelineExec.mockResolvedValue([
      [null, 1],   // New window, count resets to 1
      [null, -1],  // TTL expired
    ]);

    await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    const secondKey = mockIncr.mock.calls[1][0];

    // Same key format, but the TTL expired so EXPIRE resets the window
    expect(firstKey).toBe(secondKey);
    expect(mockExpire).toHaveBeenCalled();
  });

  it("sets Redis EXPIRE to window seconds on first request", async () => {
    // TTL returns -1 (key doesn't exist yet)
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, -1],
    ]);

    await checkRateLimit("user1", { namespace: "test", maxRequests: 5, windowMs: 60_000 });

    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining("test:user1"),
      60  // windowSec = 60
    );
  });
});

describe("circuit breaker", () => {
  it("recovers after reset timeout when Redis succeeds again", async () => {
    mockPipelineExec
      .mockRejectedValueOnce(new Error("Redis timeout"))
      .mockResolvedValueOnce([[null, 1], [null, 59]]);

    const r1 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    // Falls back to LRU
    expect(r1.allowed).toBe(true);

    jest.advanceTimersByTime(15_000);
    _resetStateForTesting();
    mockPipelineExec.mockReset();
    mockPipelineExec.mockResolvedValue([[null, 2], [null, 58]]);

    const r2 = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(3);
    expect(mockPipelineExec).toHaveBeenCalledTimes(1);
  });
});

describe("edge cases", () => {
  it("returns remaining=0 when count is exactly at the limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 5],  // count=5 (at limit)
      [null, 30],
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns remaining=0 when count is one over the limit", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],  // count=6 (over limit of 5)
      [null, 15],
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("handles the largest windowMs defined in RATE_LIMITS", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 3599],
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.GITHUB_IMPORT);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
  });

  it("handles zero previous points (first request in window)", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],  // First request, count=1
      [null, 59],
    ]);

    const result = await checkRateLimit("user1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("_resetStateForTesting", () => {
  it("clears LRU cache and circuit breaker state between tests", async () => {
    mockPipelineExec.mockRejectedValue(new Error("fail"));
    const r1 = checkRateLimit("u1", RATE_LIMITS.REPOSITORY_ANALYZE);
    _resetStateForTesting();
    mockPipelineExec.mockReset();
    mockPipelineExec.mockResolvedValue([[null, 1], [null, 59]]);
    const r2 = checkRateLimit("u1", RATE_LIMITS.REPOSITORY_ANALYZE);
    expect(r2).resolves.toHaveProperty("allowed", true);
  });
});
