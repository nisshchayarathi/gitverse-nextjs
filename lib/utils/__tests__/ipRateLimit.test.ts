import { checkAiRateLimit, logAiRequest, cleanupStaleLogs, _resetCleanupIntervalForTesting } from "../ipRateLimit";

const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    aiRequestLog: {
      count: (...args: any[]) => mockCount(...args),
      create: (...args: any[]) => mockCreate(...args),
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

describe("checkAiRateLimit", () => {
  it("returns true when count is below maxRequests (userId field)", async () => {
    mockCount.mockResolvedValue(3);

    const result = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
    expect(result).toBe(true);
  });

  it("returns false when count equals maxRequests", async () => {
    mockCount.mockResolvedValue(20);

    const result = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
    expect(result).toBe(false);
  });

  it("returns false when count exceeds maxRequests", async () => {
    mockCount.mockResolvedValue(25);

    const result = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
    expect(result).toBe(false);
  });

  it("queries with correct userId filter", async () => {
    mockCount.mockResolvedValue(0);

    await checkAiRateLimit("42", "userId", "analyze-code", 20, 60_000);

    expect(mockCount).toHaveBeenCalledWith({
      where: {
        userId: 42,
        endpoint: "analyze-code",
        createdAt: { gte: expect.any(Date) },
      },
    });
  });

  it("queries with correct ip filter", async () => {
    mockCount.mockResolvedValue(0);

    await checkAiRateLimit("203.0.113.42", "ip", "generate-readme", 5, 60_000);

    expect(mockCount).toHaveBeenCalledWith({
      where: {
        ip: "203.0.113.42",
        endpoint: "generate-readme",
        createdAt: { gte: expect.any(Date) },
      },
    });
  });

  it("uses default maxRequests when not provided", async () => {
    mockCount.mockResolvedValue(19);

    const result = await checkAiRateLimit("42", "userId", "chat");
    expect(result).toBe(true);
  });

  it("uses default windowMs when not provided", async () => {
    mockCount.mockResolvedValue(0);

    await checkAiRateLimit("42", "userId", "chat");

    const where = mockCount.mock.calls[0][0].where;
    const since = where.createdAt.gte.getTime();
    expect(since).toBe(Date.now() - 60_000);
  });

  it("handles different endpoints independently", async () => {
    mockCount.mockImplementation(({ where }: any) => {
      if (where.endpoint === "chat") return Promise.resolve(20);
      if (where.endpoint === "analyze-code") return Promise.resolve(5);
      return Promise.resolve(0);
    });

    const chatResult = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
    expect(chatResult).toBe(false);

    const analyzeResult = await checkAiRateLimit("42", "userId", "analyze-code", 20, 60_000);
    expect(analyzeResult).toBe(true);
  });

  it("uses the correct time window for queries", async () => {
    mockCount.mockResolvedValue(0);

    await checkAiRateLimit("42", "userId", "chat", 20, 120_000);

    const where = mockCount.mock.calls[0][0].where;
    const since = where.createdAt.gte.getTime();
    expect(since).toBe(Date.now() - 120_000);
  });

  it("returns false on database errors (fail-closed)", async () => {
    mockCount.mockRejectedValue(new Error("DB connection failed"));

    const result = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
    expect(result).toBe(false);
  });

  it("distinguishes between different users for same endpoint", async () => {
    mockCount.mockImplementation(({ where }: any) => {
      if (where.userId === 1) return Promise.resolve(20);
      return Promise.resolve(3);
    });

    const user1Result = await checkAiRateLimit("1", "userId", "chat", 20, 60_000);
    expect(user1Result).toBe(false);

    const user2Result = await checkAiRateLimit("2", "userId", "chat", 20, 60_000);
    expect(user2Result).toBe(true);
  });

  it("returns false on various database error types", async () => {
    const errors = [
      new Error("Connection pool exhausted"),
      new Error("Timeout"),
      new Error("PrismaClientInitializationError"),
    ];

    for (const error of errors) {
      mockCount.mockRejectedValue(error);
      const result = await checkAiRateLimit("42", "userId", "chat", 20, 60_000);
      expect(result).toBe(false);
    }
  });
});

describe("logAiRequest", () => {
  it("creates record with all fields", async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    await logAiRequest({
      userId: 42,
      ip: "203.0.113.42",
      endpoint: "chat",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: 42,
        ip: "203.0.113.42",
        endpoint: "chat",
      },
    });
  });

  it("stores null userId when not provided", async () => {
    mockCreate.mockResolvedValue({ id: 2 });

    await logAiRequest({
      ip: "198.51.100.7",
      endpoint: "analyze-code",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: null,
        ip: "198.51.100.7",
        endpoint: "analyze-code",
      },
    });
  });

  it("handles different endpoints", async () => {
    mockCreate.mockResolvedValue({ id: 3 });

    await logAiRequest({
      userId: 7,
      ip: "10.0.0.1",
      endpoint: "generate-readme",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endpoint: "generate-readme" }),
      })
    );
  });

  it("handles database errors gracefully (fire-and-forget)", async () => {
    mockCreate.mockRejectedValue(new Error("DB write failed"));

    await expect(
      logAiRequest({
        userId: 42,
        ip: "203.0.113.42",
        endpoint: "chat",
      })
    ).resolves.toBeUndefined();
  });

  it("logs requests with ip-only identification", async () => {
    mockCreate.mockResolvedValue({ id: 4 });

    await logAiRequest({
      ip: "203.0.113.42",
      endpoint: "simulate-pr",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip: "203.0.113.42" }),
      })
    );
  });
});

describe("cleanupStaleLogs", () => {
  beforeEach(() => {
    _resetCleanupIntervalForTesting();
  });

  it("deletes logs older than 7 days", async () => {
    mockDeleteMany.mockResolvedValue({ count: 50 });

    await cleanupStaleLogs();

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
  });

  it("uses 7-day retention threshold", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await cleanupStaleLogs();

    const where = mockDeleteMany.mock.calls[0][0].where;
    const threshold = where.createdAt.lt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(threshold).toBe(Date.now() - sevenDaysMs);
  });

  it("handles database errors gracefully", async () => {
    mockDeleteMany.mockRejectedValue(new Error("DB cleanup failed"));

    await expect(cleanupStaleLogs()).resolves.toBeUndefined();
  });

  it("skips cleanup if called within interval", async () => {
    mockDeleteMany.mockResolvedValue({ count: 10 });

    await cleanupStaleLogs();
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30 * 60 * 1000);

    await cleanupStaleLogs();
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup again after interval elapses", async () => {
    mockDeleteMany.mockResolvedValue({ count: 10 });

    await cleanupStaleLogs();
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60 * 60 * 1000 + 1);

    await cleanupStaleLogs();
    expect(mockDeleteMany).toHaveBeenCalledTimes(2);
  });
});
