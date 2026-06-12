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

const { checkRateLimit } = require("../rateLimiter");

beforeEach(() => {
  jest.clearAllMocks();
  resetPipelineMocks();
});

describe("Rate limit namespace isolation — security critical", () => {
  it("mfa:verify and ai:analyze-repository use separate Redis keys", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    await checkRateLimit({
      endpoint: "ai:analyze-repository",
      userId: 42,
      tier: "free",
    });

    const calls = mockPipelineInc.mock.calls;
    const keys = calls.map((c: string[]) => c[0]);

    expect(keys).toContain("rl:mfa:verify:u:42");
    expect(keys).toContain("rl:ai:analyze-repository:u:42");
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it("exhausting mfa:verify does not affect ai:analyze-repository", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const mfaResult = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(mfaResult.allowed).toBe(false);
    expect(mfaResult.remaining).toBe(0);

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const aiResult = await checkRateLimit({
      endpoint: "ai:analyze-repository",
      userId: 42,
      tier: "free",
    });
    expect(aiResult.allowed).toBe(true);
    expect(aiResult.remaining).toBe(4);
  });

  it("exhausting ai:analyze-repository does not affect mfa:verify", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const aiResult = await checkRateLimit({
      endpoint: "ai:analyze-repository",
      userId: 42,
      tier: "free",
    });
    expect(aiResult.allowed).toBe(false);

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const mfaResult = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(mfaResult.allowed).toBe(true);
    expect(mfaResult.remaining).toBe(4);
  });

  it("mfa:setup has independent quota from mfa:verify", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 300],
    ]);

    const setupResult = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: 42,
      tier: "free",
    });
    expect(setupResult.allowed).toBe(false);

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const verifyResult = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(verifyResult.allowed).toBe(true);
    expect(verifyResult.remaining).toBe(4);
  });

  it("premium tier for mfa:verify allows 20 requests per window", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 21],
      [null, 60],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "premium",
    });

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(20);

    mockPipelineExec.mockResolvedValue([
      [null, 19],
      [null, 60],
    ]);

    const second = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "premium",
    });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("mfa:setup window is 300 seconds (5 minutes)", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 300],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: 42,
      tier: "free",
    });

    expect(result.windowSec).toBe(300);
    expect(result.resetInSec).toBe(300);
  });

  it("same endpoint for different users uses different keys", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const resultA = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 1,
      tier: "free",
    });
    expect(resultA.allowed).toBe(false);

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const resultB = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 2,
      tier: "free",
    });
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(4);
  });

  it("same endpoint for IP fallback uses different keys", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const resultA = await checkRateLimit({
      endpoint: "mfa:verify",
      ip: "203.0.113.1",
      tier: "free",
    });
    expect(resultA.allowed).toBe(false);

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const resultB = await checkRateLimit({
      endpoint: "mfa:verify",
      ip: "203.0.113.2",
      tier: "free",
    });
    expect(resultB.allowed).toBe(true);
  });

  it("brute-force scenario: 6 consecutive MFA attempts blocks on 6th", async () => {
    for (let i = 1; i <= 5; i++) {
      mockPipelineExec.mockResolvedValue([
        [null, i],
        [null, 60],
      ]);

      const result = await checkRateLimit({
        endpoint: "mfa:verify",
        userId: 42,
        tier: "free",
      });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i);
    }

    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const blocked = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("ai:analyze-repository remains functional after MFA rate limit is exhausted", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });

    mockPipelineExec.mockResolvedValue([
      [null, 0],
      [null, 60],
    ]);

    const analysisResult = await checkRateLimit({
      endpoint: "ai:analyze-repository",
      userId: 42,
      tier: "free",
    });
    expect(analysisResult.allowed).toBe(true);
    expect(analysisResult.limit).toBe(5);
  });

  it("namespace keys differ structurally from each other", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    const endpoints = [
      "mfa:verify",
      "mfa:setup",
      "ai:analyze-repository",
      "ai:chat",
      "ai:explain-file",
      "ai:generate-readme",
      "ai:review-pr",
      "repositories:file-content",
    ];

    const keys: string[] = [];
    for (const ep of endpoints) {
      await checkRateLimit({
        endpoint: ep,
        userId: 42,
        tier: "free",
      });
    }

    for (const call of mockPipelineInc.mock.calls) {
      keys.push(call[0]);
    }

    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(endpoints.length);
  });

  it("Redis key format includes namespace prefix before colon", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });

    const key = mockPipelineInc.mock.calls[0][0];
    expect(key).toMatch(/^rl:/);
    expect(key).toContain("mfa:verify");
    expect(key).toContain("u:42");
  });

  it("default quota applies to unknown endpoints but does not collide with mfa keys", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "some:unknown",
      userId: 42,
      tier: "free",
    });

    const unknownKey = mockPipelineInc.mock.calls[0][0];
    expect(unknownKey).toBe("rl:some:unknown:u:42");

    mockPipelineExec.mockResolvedValue([
      [null, 1],
      [null, 60],
    ]);

    await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });

    const mfaKey = mockPipelineInc.mock.calls[1][0];
    expect(mfaKey).toBe("rl:mfa:verify:u:42");
  });

  it("mfa:setup with premium tier has 20 requests per window", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 21],
      [null, 300],
    ]);

    const result = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: 42,
      tier: "premium",
    });

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(20);
  });

  it("mfa:verify blocks at exactly count > limit (6th request)", async () => {
    mockPipelineExec.mockResolvedValue([
      [null, 5],
      [null, 60],
    ]);

    const atLimit = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(atLimit.allowed).toBe(true);
    expect(atLimit.remaining).toBe(0);

    mockPipelineExec.mockResolvedValue([
      [null, 6],
      [null, 60],
    ]);

    const overLimit = await checkRateLimit({
      endpoint: "mfa:verify",
      userId: 42,
      tier: "free",
    });
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);
  });
});

export {};

