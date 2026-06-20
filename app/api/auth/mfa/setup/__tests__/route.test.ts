import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";

const mockRequireAuth = jest.fn();
const mockGenerateTOTPSecret = jest.fn();
const mockBuildOtpAuthUri = jest.fn();
const mockUpsertMfaSecret = jest.fn();
const mockGetMfaStatus = jest.fn();
const mockGetDecryptedTotpSecret = jest.fn();
const mockVerifyTOTP = jest.fn();
const mockDisableMfa = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockRateLimitResponse = jest.fn();
const mockGetClientIp = jest.fn();

const mockUserFindUnique = jest.fn();
const mockMfaConfigFindUnique = jest.fn();

jest.mock("@/lib/middleware", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isHttpError: (e: any) => e?.status != null,
  sanitizeError: (e: any) => String(e),
}));

jest.mock("@/lib/mfa", () => ({
  generateTOTPSecret: (...args: any[]) => mockGenerateTOTPSecret(...args),
  buildOtpAuthUri: (...args: any[]) => mockBuildOtpAuthUri(...args),
  upsertMfaSecret: (...args: any[]) => mockUpsertMfaSecret(...args),
  getMfaStatus: (...args: any[]) => mockGetMfaStatus(...args),
  getDecryptedTotpSecret: (...args: any[]) => mockGetDecryptedTotpSecret(...args),
  verifyTOTP: (...args: any[]) => mockVerifyTOTP(...args),
  disableMfa: (...args: any[]) => mockDisableMfa(...args),
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
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    mfaConfig: {
      findUnique: (...args: any[]) => mockMfaConfigFindUnique(...args),
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

describe("POST /api/auth/mfa/setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, windowSec: 300, limit: 5, resetInSec: 300 });
    mockRequireAuth.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockUserFindUnique.mockResolvedValue({ email: "test@test.com" });
    mockGetMfaStatus.mockResolvedValue(null);
    mockGenerateTOTPSecret.mockReturnValue("JBSWY3DPEHPK3PXP");
    mockBuildOtpAuthUri.mockReturnValue("otpauth://totp/test@test.com?secret=JBSWY3DPEHPK3PXP");
    mockUpsertMfaSecret.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, message: "Not authenticated" });

    const response = await POST(mockRequest());
    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    mockRateLimitResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
      }),
    );

    const response = await POST(mockRequest());
    expect(response.status).toBe(429);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RATE_LIMIT_EXCEEDED" }),
    );
  });

  it("calls checkRateLimit with mfa:setup endpoint", async () => {
    await POST(mockRequest());
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "mfa:setup" }),
    );
  });

  it("returns 404 when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const response = await POST(mockRequest());
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("User not found");
  });

  it("returns 409 when MFA is already enabled", async () => {
    mockGetMfaStatus.mockResolvedValue({ isEnabled: true });

    const response = await POST(mockRequest());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("already enabled");
  });

  it("generates secret and returns otpauth URI on success", async () => {
    const response = await POST(mockRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(body.otpauthUri).toContain("otpauth://");
    expect(body.message).toContain("QR code");
    expect(mockUpsertMfaSecret).toHaveBeenCalledWith(1, "JBSWY3DPEHPK3PXP");
  });

  it("includes user email in otpauth URL", async () => {
    const response = await POST(mockRequest());
    const body = await response.json();
    expect(body.otpauthUri).toContain("test@test.com");
  });

  it("logs audit event on successful setup", async () => {
    await POST(mockRequest());
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MFA_ENABLED",
        details: expect.objectContaining({ stage: "setup_initiated" }),
      }),
    );
  });

  it("passes user tier to rate limiter", async () => {
    await POST(mockRequest());
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "mfa:setup",
        userId: 1,
        tier: "free",
      }),
    );
  });

  it("handles errors gracefully", async () => {
    mockUserFindUnique.mockRejectedValue(new Error("DB error"));

    const response = await POST(mockRequest());
    expect(response.status).toBe(500);
  });

  it("handles server errors gracefully", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST(mockRequest());
    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/auth/mfa/setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, windowSec: 300, limit: 5, resetInSec: 300 });
    mockRequireAuth.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockGetMfaStatus.mockResolvedValue({ isEnabled: true });
    mockGetDecryptedTotpSecret.mockResolvedValue("JBSWY3DPEHPK3PXP");
    mockVerifyTOTP.mockReturnValue(true);
    mockDisableMfa.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue({ status: 401, message: "Not authenticated" });

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    mockRateLimitResponse.mockReturnValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
      }),
    );

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(429);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RATE_LIMIT_EXCEEDED" }),
    );
  });

  it("calls checkRateLimit with mfa:setup endpoint", async () => {
    await DELETE(mockRequest({ token: "123456" }));
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "mfa:setup" }),
    );
  });

  it("returns 400 when no token provided", async () => {
    const response = await DELETE(mockRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("6-digit");
  });

  it("returns 400 when token is not 6 digits", async () => {
    const response = await DELETE(mockRequest({ token: "abc" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 when MFA is not enabled", async () => {
    mockGetMfaStatus.mockResolvedValue({ isEnabled: false });

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("not currently enabled");
  });

  it("returns 409 when no config exists", async () => {
    mockGetDecryptedTotpSecret.mockResolvedValue(null);

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(409);
  });

  it("returns 401 when TOTP token is invalid", async () => {
    mockVerifyTOTP.mockReturnValue(false);

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("disables MFA with valid token", async () => {
    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("disabled");
    expect(mockDisableMfa).toHaveBeenCalledWith(1);
  });

  it("logs audit event on successful disable", async () => {
    await DELETE(mockRequest({ token: "123456" }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MFA_DISABLED" }),
    );
  });

  it("logs audit event on MFA verification failure", async () => {
    mockVerifyTOTP.mockReturnValue(false);

    await DELETE(mockRequest({ token: "123456" }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MFA_FAILED" }),
    );
  });

  it("handles server errors gracefully", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

    const response = await DELETE(mockRequest({ token: "123456" }));
    expect(response.status).toBe(500);
  });
});
