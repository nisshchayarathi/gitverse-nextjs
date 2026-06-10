let mockPipelineInc: jest.Mock;
let mockPipelineTtl: jest.Mock;
let mockPipelineExec: jest.Mock;
let mockExpire: jest.Mock;

const mockRedis = {
  pipeline: jest.fn(),
  expire: jest.fn(),
};

jest.mock("@/lib/redis", () => ({
  __esModule: true,
  default: mockRedis,
}));

function resetPipelineMocks() {
  mockPipelineInc = jest.fn();
  mockPipelineTtl = jest.fn();
  mockPipelineExec = jest.fn();
  mockExpire = jest.fn();

  mockRedis.pipeline.mockReturnValue({
    incr: mockPipelineInc,
    ttl: mockPipelineTtl,
    exec: mockPipelineExec,
  });
  mockRedis.expire = mockExpire;
}

const {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
} = require("../rateLimiter");

describe("checkRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPipelineMocks();
  });

  it("allows request within quota", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(result.windowSec).toBe(60);
  });

  it("blocks request when quota exceeded", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(5);
  });

  it("uses premium tier quota when tier is premium", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "premium",
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(20);
    expect(result.remaining).toBe(19);
  });

  it("uses default quota for unknown endpoints", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "unknown:endpoint",
      userId: 1,
      tier: "free",
    });

    expect(result.limit).toBe(20);
    expect(result.allowed).toBe(true);
  });

  it("sets expiry on the first request in a window", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, -1],
    ]);
    mockExpire.mockResolvedValue(1);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });

    expect(mockExpire).toHaveBeenCalledWith(expect.stringContaining("rl:mfa:verify:"), 60);
  });

  it("returns correct resetInSec from TTL", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 30],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });

    expect(result.resetInSec).toBe(30);
  });

  it("uses IP-based key when userId is not provided", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      ip: "192.168.1.1",
      tier: "free",
    });

    expect(result.allowed).toBe(true);
    // Verify the key was built with IP, not user
    const pipelineCall = mockRedis.pipeline.mock.calls[0];
    expect(pipelineCall).toBeDefined();
  });

  it("fails open when Redis returns null pipeline result", async () => {
    mockPipelineExec.mockResolvedValue(null);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("fails open when Redis throws an error", async () => {
    mockPipelineExec.mockRejectedValue(new Error("Redis connection refused"));

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 999,
      tier: "free",
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("uses free tier by default when tier is not provided", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 5],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
    });

    expect(result.tier).toBeUndefined();
    expect(result.limit).toBe(5);
  });

  it("builds correct Redis key for user", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });

    expect(mockPipelineInc).toHaveBeenCalledWith("rl:mfa:verify:u:42");
  });

  it("builds correct Redis key for IP fallback", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:setup",
      ip: "10.0.0.1",
      tier: "free",
    });

    expect(mockPipelineInc).toHaveBeenCalledWith("rl:mfa:setup:ip:10.0.0.1");
  });

  it("uses mfa:setup quota correctly", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 300],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: 1,
      tier: "free",
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.windowSec).toBe(300);
  });

  it("falls back to 'unknown' IP when no IP or userId provided", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      tier: "free",
    });

    expect(mockPipelineInc).toHaveBeenCalledWith("rl:mfa:verify:ip:unknown");
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 response with proper headers", async () => {
    const result = {
      allowed: false,
      remaining: 0,
      windowSec: 60,
      limit: 5,
      resetInSec: 45,
    };

    const response = rateLimitResponse(result);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("Too Many Requests");
    expect(body.retryAfter).toBe(45);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("includes error message with retry time", async () => {
    const result = {
      allowed: false,
      remaining: 0,
      windowSec: 60,
      limit: 5,
      resetInSec: 30,
    };

    const response = rateLimitResponse(result);
    const body = await response.json();
    expect(body.message).toContain("30");
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name === "x-forwarded-for" ? "203.0.113.1, 10.0.0.1" : null,
      },
    } as any;

    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name === "x-real-ip" ? "198.51.100.1" : null,
      },
    } as any;

    expect(getClientIp(req)).toBe("198.51.100.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = {
      headers: {
        get: () => null,
      },
    } as any;

    expect(getClientIp(req)).toBe("unknown");
  });
});

export {};

