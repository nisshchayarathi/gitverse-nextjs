import { NextRequest } from "next/server";
import { POST, GET } from "../route";

const mockRequireAuth = jest.fn();
const mockVerifyTOTP = jest.fn();
const mockEnableMfa = jest.fn();
const mockGenerateBackupCodes = jest.fn();
const mockVerifyAndConsumeBackupCode = jest.fn();
const mockGetDecryptedTotpSecret = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockRateLimitResponse = jest.fn();
const mockGetClientIp = jest.fn();
const mockPrismaFindUnique = jest.fn();
const mockPrismaUpdate = jest.fn();

jest.mock("@/lib/middleware", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isHttpError: (e: any) => e?.status != null,
  sanitizeError: (e: any) => String(e),
}));

jest.mock("@/lib/mfa", () => ({
  verifyTOTP: (...args: any[]) => mockVerifyTOTP(...args),
  enableMfa: (...args: any[]) => mockEnableMfa(...args),
  generateBackupCodes: (...args: any[]) => mockGenerateBackupCodes(...args),
  verifyAndConsumeBackupCode: (...args: any[]) =>
    mockVerifyAndConsumeBackupCode(...args),
  getDecryptedTotpSecret: (...args: any[]) =>
    mockGetDecryptedTotpSecret(...args),
}));

jest.mock("@/lib/auditLogger", () => ({
  logAuditEvent: (...args: any[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/rateLimiter", () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
  rateLimitResponse: (...args: any[]) => mockRateLimitResponse(...args),
  getClientIp: (...args: any[]) => mockGetClientIp(...args),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    mfaConfig: {
      findUnique: (...args: any[]) => mockPrismaFindUnique(...args),
      update: (...args: any[]) => mockPrismaUpdate(...args),
    },
  },
}));

function mockRequest(body?: any, authHeader?: string): NextRequest {
  return {
    json: () => Promise.resolve(body ?? {}),
    headers: {
      get: (name: string) =>
        name === "authorization" ? authHeader || "Bearer token" : null,
    },
  } as unknown as NextRequest;
}

describe("POST /api/auth/mfa/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, windowSec: 60, limit: 5, resetInSec: 60 });
    mockRequireAuth.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockGetDecryptedTotpSecret.mockResolvedValue("JBSWY3DPEHPK3PXP");
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: false });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, message: "Not authenticated" });

    const response = await POST(mockRequest({}));
    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    mockRateLimitResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    );

    const response = await POST(mockRequest({ token: "123456" }));
    expect(response.status).toBe(429);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RATE_LIMIT_EXCEEDED" }),
    );
  });

  it("returns 400 when neither token nor backupCode provided", async () => {
    const response = await POST(mockRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("token or a backup code");
  });

  it("returns 409 when MFA not initialized", async () => {
    mockGetDecryptedTotpSecret.mockResolvedValue(null);

    const response = await POST(mockRequest({ token: "123456" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("not initialized");
  });

  it("returns 409 when backup code used but MFA not enabled", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: false });

    const response = await POST(mockRequest({ backupCode: "ABCD-EFGH" }));
    expect(response.status).toBe(409);
  });

  it("returns 401 for invalid backup code", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: true });
    mockVerifyAndConsumeBackupCode.mockResolvedValue(false);

    const response = await POST(mockRequest({ backupCode: "INVALID-CODE" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("accepts valid backup code", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: true });
    mockVerifyAndConsumeBackupCode.mockResolvedValue(true);

    const response = await POST(mockRequest({ backupCode: "VALID-CODE" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(true);
    expect(body.method).toBe("backup_code");
  });

  it("returns 400 for invalid token format", async () => {
    const response = await POST(mockRequest({ token: "abc" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("6-digit");
  });

  it("returns 401 for invalid TOTP token", async () => {
    mockVerifyTOTP.mockReturnValue(false);

    const response = await POST(mockRequest({ token: "123456" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("enrolls MFA with valid token in enroll mode", async () => {
    mockVerifyTOTP.mockReturnValue(true);
    mockGenerateBackupCodes.mockReturnValue({
      plaintext: ["CODE1", "CODE2"],
      hashed: ["hash1", "hash2"],
    });
    mockEnableMfa.mockResolvedValue(undefined);

    const response = await POST(mockRequest({ token: "123456", mode: "enroll" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(true);
    expect(body.enrolled).toBe(true);
    expect(body.backupCodes).toEqual(["CODE1", "CODE2"]);
    expect(mockEnableMfa).toHaveBeenCalledWith(1, ["hash1", "hash2"]);
  });

  it("returns 409 when enrolling but MFA already enabled", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: true });
    mockVerifyTOTP.mockReturnValue(true);

    const response = await POST(mockRequest({ token: "123456", mode: "enroll" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("already enrolled");
  });

  it("verifies TOTP for authentication mode", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: true });
    mockVerifyTOTP.mockReturnValue(true);

    const response = await POST(mockRequest({ token: "123456", mode: "authenticate" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.verified).toBe(true);
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        data: expect.objectContaining({ lastVerifiedAt: expect.any(Date) }),
      }),
    );
  });

  it("returns 409 when MFA not enabled during authentication", async () => {
    mockPrismaFindUnique.mockResolvedValue({ isEnabled: false });
    mockVerifyTOTP.mockReturnValue(true);

    const response = await POST(mockRequest({ token: "123456", mode: "authenticate" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("not enabled");
  });

  it("logs audit event on rate limit exceed", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    mockRateLimitResponse.mockReturnValue(
      new Response(null, { status: 429 }),
    );

    await POST(mockRequest({ token: "123456" }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RATE_LIMIT_EXCEEDED",
        resource: "User:MFA",
      }),
    );
  });

  it("logs audit event on MFA failure", async () => {
    mockVerifyTOTP.mockReturnValue(false);

    await POST(mockRequest({ token: "123456" }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MFA_FAILED",
        details: expect.objectContaining({ method: "totp" }),
      }),
    );
  });

  it("handles server errors gracefully", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST(mockRequest({ token: "123456" }));
    expect(response.status).toBe(500);
  });
});

describe("GET /api/auth/mfa/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 1, email: "test@test.com" });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, message: "Not authenticated" });

    const response = await GET(mockRequest());
    expect(response.status).toBe(401);
  });

  it("returns MFA status when config exists", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      isEnabled: true,
      lastVerifiedAt: new Date("2024-01-01"),
      createdAt: new Date("2023-06-01"),
    });

    const response = await GET(mockRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mfaEnabled).toBe(true);
    expect(body.lastVerifiedAt).toBeDefined();
    expect(body.enrolledAt).toBeDefined();
  });

  it("returns defaults when no config exists", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    const response = await GET(mockRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mfaEnabled).toBe(false);
    expect(body.lastVerifiedAt).toBeNull();
    expect(body.enrolledAt).toBeNull();
  });
});
