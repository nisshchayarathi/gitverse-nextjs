import { NextRequest } from "next/server";
import {
  isRateLimited,
  countAttempts,
  recordAttempt,
  clearFailedAttempts,
  cleanupStaleAttempts,
  getClientIp,
} from "../rateLimitService";

const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    loginAttempt: {
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

describe("getClientIp", () => {
  function mockRequest(headers: Record<string, string>, ip?: string): NextRequest {
    return {
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      ip: ip ?? undefined,
    } as unknown as NextRequest;
  }

  it("returns IP from x-forwarded-for header", () => {
    const req = mockRequest({ "x-forwarded-for": "203.0.113.42" });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("returns first IP from multi-value x-forwarded-for", () => {
    const req = mockRequest({ "x-forwarded-for": "203.0.113.42, 198.51.100.7, 10.0.0.1" });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("falls back to x-real-ip when no forwarded header", () => {
    const req = mockRequest({ "x-real-ip": "198.51.100.7" });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("prioritizes x-forwarded-for over x-real-ip", () => {
    const req = mockRequest({
      "x-forwarded-for": "203.0.113.42",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("returns request.ip when no headers present", () => {
    const req = mockRequest({}, "10.0.0.1");
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns unknown when no IP info available", () => {
    const req = mockRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("ignores unknown value in x-forwarded-for and falls back", () => {
    const req = mockRequest({
      "x-forwarded-for": "unknown",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("falls back to request.ip when x-forwarded-for is unknown", () => {
    const req = mockRequest({ "x-forwarded-for": "unknown" }, "10.0.0.1");
    expect(getClientIp(req)).toBe("10.0.0.1");
  });
});

describe("isRateLimited", () => {
  const key = "user:42";
  const type = "LOGIN" as const;
  const maxAttempts = 5;
  const windowMs = 60_000;

  it("returns false when count is below maxAttempts", async () => {
    mockCount.mockResolvedValue(3);

    const result = await isRateLimited(key, type, maxAttempts, windowMs);
    expect(result).toBe(false);
  });

  it("returns true when count equals maxAttempts", async () => {
    mockCount.mockResolvedValue(5);

    const result = await isRateLimited(key, type, maxAttempts, windowMs);
    expect(result).toBe(true);
  });

  it("returns true when count exceeds maxAttempts", async () => {
    mockCount.mockResolvedValue(10);

    const result = await isRateLimited(key, type, maxAttempts, windowMs);
    expect(result).toBe(true);
  });

  it("queries only failed attempts in the time window", async () => {
    mockCount.mockResolvedValue(0);

    await isRateLimited(key, type, maxAttempts, windowMs);

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key,
          type,
          createdAt: { gte: expect.any(Date) },
          success: false,
        },
      })
    );
  });

  it("uses the correct time window", async () => {
    mockCount.mockResolvedValue(0);

    await isRateLimited(key, type, maxAttempts, windowMs);

    const where = mockCount.mock.calls[0][0].where;
    const since = where.createdAt.gte.getTime();
    expect(since).toBe(Date.now() - windowMs);
  });

  it("distinguishes between different keys", async () => {
    mockCount.mockImplementation(({ where: { key: k } }: any) => {
      if (k === "user:1") return Promise.resolve(5);
      return Promise.resolve(0);
    });

    expect(await isRateLimited("user:1", type, maxAttempts, windowMs)).toBe(true);
    expect(await isRateLimited("user:2", type, maxAttempts, windowMs)).toBe(false);
  });

  it("distinguishes between different attempt types", async () => {
    mockCount.mockImplementation(({ where: { type: t } }: any) => {
      if (t === "LOGIN") return Promise.resolve(5);
      return Promise.resolve(0);
    });

    expect(await isRateLimited(key, "LOGIN", maxAttempts, windowMs)).toBe(true);
    expect(await isRateLimited(key, "SIGNUP", maxAttempts, windowMs)).toBe(false);
  });

  it("throws on database errors (fail-closed)", async () => {
    mockCount.mockRejectedValue(new Error("Connection pool exhausted"));

    await expect(isRateLimited(key, type, maxAttempts, windowMs)).rejects.toThrow(
      "Connection pool exhausted"
    );
  });

  it("supports different maxAttempts values", async () => {
    mockCount.mockResolvedValue(3);

    expect(await isRateLimited(key, type, 3, windowMs)).toBe(true);
    expect(await isRateLimited(key, type, 5, windowMs)).toBe(false);
  });

  it("handles zero maxAttempts (always rate limited)", async () => {
    mockCount.mockResolvedValue(0);

    const result = await isRateLimited(key, type, 0, windowMs);
    expect(result).toBe(true);
  });

  it("handles very large windowMs", async () => {
    mockCount.mockResolvedValue(1);

    const result = await isRateLimited(key, type, 5, 86_400_000);
    expect(result).toBe(false);
  });
});

describe("countAttempts", () => {
  const key = "ip:192.168.1.1";
  const type = "SIGNUP" as const;
  const windowMs = 3600_000;

  it("returns count from database", async () => {
    mockCount.mockResolvedValue(7);

    const result = await countAttempts(key, type, windowMs);
    expect(result).toBe(7);
  });

  it("returns zero when no attempts exist", async () => {
    mockCount.mockResolvedValue(0);

    const result = await countAttempts(key, type, windowMs);
    expect(result).toBe(0);
  });

  it("queries with correct key and type", async () => {
    mockCount.mockResolvedValue(0);

    await countAttempts(key, type, windowMs);

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key,
          type,
          createdAt: { gte: expect.any(Date) },
        },
      })
    );
  });

  it("uses the correct time window", async () => {
    mockCount.mockResolvedValue(0);

    await countAttempts(key, type, windowMs);

    const where = mockCount.mock.calls[0][0].where;
    const since = where.createdAt.gte.getTime();
    expect(since).toBe(Date.now() - windowMs);
  });

  it("counts both successful and failed attempts", async () => {
    mockCount.mockResolvedValue(5);

    await countAttempts(key, type, windowMs);

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          success: expect.anything(),
        }),
      })
    );
  });

  it("thows on database errors (fail-closed)", async () => {
    mockCount.mockRejectedValue(new Error("DB connection timeout"));

    await expect(countAttempts(key, type, windowMs)).rejects.toThrow(
      "DB connection timeout"
    );
  });
});

describe("recordAttempt", () => {
  it("creates record with all fields", async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    await recordAttempt({
      key: "user:42",
      type: "LOGIN",
      success: false,
      email: "test@example.com",
      userId: 42,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        key: "user:42",
        type: "LOGIN",
        success: false,
        email: "test@example.com",
        userId: 42,
      },
    });
  });

  it("creates record with null email and userId when not provided", async () => {
    mockCreate.mockResolvedValue({ id: 2 });

    await recordAttempt({
      key: "ip:10.0.0.1",
      type: "SIGNUP",
      success: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        key: "ip:10.0.0.1",
        type: "SIGNUP",
        success: true,
        email: null,
        userId: null,
      },
    });
  });

  it("records failed login attempts", async () => {
    mockCreate.mockResolvedValue({ id: 3 });

    await recordAttempt({
      key: "user:42",
      type: "LOGIN",
      success: false,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      })
    );
  });

  it("records successful login attempts", async () => {
    mockCreate.mockResolvedValue({ id: 4 });

    await recordAttempt({
      key: "user:42",
      type: "LOGIN",
      success: true,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: true }),
      })
    );
  });

  it("records CHANGE_PASSWORD attempts", async () => {
    mockCreate.mockResolvedValue({ id: 5 });

    await recordAttempt({
      key: "user:7",
      type: "CHANGE_PASSWORD",
      success: false,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CHANGE_PASSWORD" }),
      })
    );
  });

  it("records DELETE_ACCOUNT attempts", async () => {
    mockCreate.mockResolvedValue({ id: 6 });

    await recordAttempt({
      key: "user:99",
      type: "DELETE_ACCOUNT",
      success: true,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "DELETE_ACCOUNT" }),
      })
    );
  });

  it("throws on database errors (fail-closed)", async () => {
    mockCreate.mockRejectedValue(new Error("DB write failed"));

    await expect(
      recordAttempt({
        key: "user:42",
        type: "LOGIN",
        success: false,
      })
    ).rejects.toThrow("DB write failed");
  });
});

describe("clearFailedAttempts", () => {
  const key = "user:42";
  const type = "LOGIN" as const;

  it("deletes failed attempts for given key and type", async () => {
    mockDeleteMany.mockResolvedValue({ count: 3 });

    await clearFailedAttempts(key, type);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { key, type, success: false },
    });
  });

  it("does not delete successful attempts", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await clearFailedAttempts(key, type);

    const where = mockDeleteMany.mock.calls[0][0].where;
    expect(where.success).toBe(false);
  });

  it("handles non-existent keys gracefully", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await expect(clearFailedAttempts("nonexistent", type)).resolves.toBeUndefined();
  });

  it("handles database errors gracefully", async () => {
    mockDeleteMany.mockRejectedValue(new Error("DB error"));

    await expect(clearFailedAttempts(key, type)).resolves.toBeUndefined();
  });
});

describe("cleanupStaleAttempts", () => {
  it("deletes attempts older than retention period", async () => {
    mockDeleteMany.mockResolvedValue({ count: 10 });

    const result = await cleanupStaleAttempts();

    expect(result).toBe(10);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
  });

  it("uses 7-day retention threshold", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await cleanupStaleAttempts();

    const where = mockDeleteMany.mock.calls[0][0].where;
    const threshold = where.createdAt.lt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(threshold).toBe(Date.now() - sevenDaysMs);
  });

  it("returns zero when no stale attempts exist", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupStaleAttempts();
    expect(result).toBe(0);
  });

  it("handles database errors gracefully", async () => {
    mockDeleteMany.mockRejectedValue(new Error("DB error"));

    const result = await cleanupStaleAttempts();
    expect(result).toBe(0);
  });
});
