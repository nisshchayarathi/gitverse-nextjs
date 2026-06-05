jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
  isHttpError: jest.fn((e) => e?.status != null),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((items: any[]) => Promise.resolve(items)),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auditLogger", () => ({
  logAuditEvent: jest.fn(),
}));

jest.mock("@/lib/rateLimiter", () => ({
  checkRateLimit: jest.fn(),
  rateLimitResponse: jest.fn(),
  getClientIp: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

const middleware = require("@/lib/middleware");
const prisma = require("@/lib/prisma");
const { logAuditEvent } = require("@/lib/auditLogger");
const { checkRateLimit, rateLimitResponse, getClientIp } = require("@/lib/rateLimiter");
const bcrypt = require("bcryptjs");

function mockRequest(body?: any, authHeader?: string): NextRequest {
  return {
    json: () => Promise.resolve(body ?? {}),
    headers: {
      get: (name: string) =>
        name === "authorization" ? authHeader || "Bearer token" : null,
    },
  } as unknown as NextRequest;
}

describe("POST /api/users/change-password", () => {
  const mockUser = { userId: 1, email: "test@example.com" };

  const mockPasswordUser = {
    id: 1,
    email: "test@example.com",
    passwordHash: "$2a$10$existinghash",
    tokenVersion: 5,
  };

  const mockOAuthUser = {
    id: 2,
    email: "oauth@example.com",
    passwordHash: null,
    tokenVersion: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      middleware.requireAuth.mockRejectedValue({ status: 401, message: "Unauthorized" });

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(401);
    });

    it("returns 500 when requireAuth throws non-http error", async () => {
      middleware.requireAuth.mockRejectedValue(new Error("Unexpected error"));

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(500);
    });
  });

  describe("Rate limiting", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
    });

    it("returns 429 when rate limited", async () => {
      checkRateLimit.mockResolvedValue({ allowed: false });
      rateLimitResponse.mockReturnValue(
        new Response(
          JSON.stringify({ error: "Too Many Requests" }),
          { status: 429, headers: { "Retry-After": "300" } }
        )
      );

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(429);
    });

    it("calls checkRateLimit with users:change-password endpoint", async () => {
      checkRateLimit.mockResolvedValue({ allowed: true });

      await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: "users:change-password" })
      );
    });

    it("passes userId and ip to rate limiter", async () => {
      checkRateLimit.mockResolvedValue({ allowed: true });

      await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, ip: "127.0.0.1" })
      );
    });
  });

  describe("Input validation", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
    });

    it("returns 400 when newPassword is missing", async () => {
      const response = await POST(mockRequest({}));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("required");
    });

    it("returns 400 when newPassword is empty string", async () => {
      const response = await POST(mockRequest({ newPassword: "" }));
      expect(response.status).toBe(400);
    });

    it("returns 400 when newPassword is shorter than 8 characters", async () => {
      const response = await POST(mockRequest({ newPassword: "Abc123!" }));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("at least 8");
    });

    it("rejects newPassword with exactly 7 characters", async () => {
      const response = await POST(mockRequest({ newPassword: "1234567" }));
      expect(response.status).toBe(400);
    });

    it("accepts newPassword with exactly 8 characters", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "12345678",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });
  });

  describe("OAuth account security fix", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
    });

    it("returns 400 when user has no passwordHash (OAuth account)", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockOAuthUser);

      const response = await POST(mockRequest({ newPassword: "AttackerPass123!" }));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("OAuth");
    });

    it("does not allow planting a password on OAuth accounts via session hijack", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockOAuthUser);

      const response = await POST(mockRequest({ newPassword: "AttackerPass123!" }));
      expect(response.status).toBe(400);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.default.user.update).not.toHaveBeenCalled();
    });

    it("rejects even when currentPassword is provided for OAuth accounts", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockOAuthUser);

      const response = await POST(mockRequest({
        newPassword: "AttackerPass123!",
        currentPassword: "anything",
      }));
      expect(response.status).toBe(400);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("rejects request that would convert OAuth account to password account", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockOAuthUser);

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(400);
      expect(prisma.default.user.update).not.toHaveBeenCalled();
    });
  });

  describe("Password verification", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
    });

    it("returns 401 when currentPassword is incorrect", async () => {
      bcrypt.compare.mockResolvedValue(false);

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "WrongPassword",
      }));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("incorrect");
    });

    it("returns 400 when currentPassword is missing for password account", async () => {
      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Current password");
    });

    it("compares password using bcrypt with stored hash", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "OldPass123!",
        "$2a$10$existinghash"
      );
    });

    it("does not hash new password when current password is wrong", async () => {
      bcrypt.compare.mockResolvedValue(false);

      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "WrongPassword",
      }));
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it("does not update user when current password is wrong", async () => {
      bcrypt.compare.mockResolvedValue(false);

      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "WrongPassword",
      }));
      expect(prisma.default.user.update).not.toHaveBeenCalled();
    });
  });

  describe("Successful password change", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("$2a$10$newhash");
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });
    });

    it("returns 200 with success message", async () => {
      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toContain("changed successfully");
    });

    it("hashes new password with bcrypt", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(bcrypt.hash).toHaveBeenCalledWith("NewPass123!", 10);
    });

    it("updates user passwordHash, passwordChangedAt, and increments tokenVersion", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            passwordHash: "$2a$10$newhash",
            passwordChangedAt: expect.any(Date),
            tokenVersion: { increment: 1 },
          }),
        })
      );
    });

    it("deletes all sessions for the user on password change", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
        })
      );
    });

    it("runs update and session delete in a transaction", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.$transaction).toHaveBeenCalledTimes(1);
      const txArg = prisma.default.$transaction.mock.calls[0][0];
      expect(txArg).toHaveLength(2);
    });
  });

  describe("Audit logging", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("$2a$10$newhash");
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });
    });

    it("logs PASSWORD_CHANGED on successful password change", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PASSWORD_CHANGED",
          userId: 1,
          resource: "User",
        })
      );
    });

    it("includes IP address in audit log", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "127.0.0.1",
          details: expect.objectContaining({ ip: "127.0.0.1" }),
        })
      );
    });

    it("does not log audit event when OAuth block returns error", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockOAuthUser);

      await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it("does not log audit event when current password is wrong", async () => {
      bcrypt.compare.mockResolvedValue(false);

      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "WrongPassword",
      }));
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it("does not log audit event when rate limited", async () => {
      checkRateLimit.mockResolvedValue({ allowed: false });
      rateLimitResponse.mockReturnValue(new Response(null, { status: 429 }));

      await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(logAuditEvent).not.toHaveBeenCalled();
    });
  });

  describe("User lookup", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
    });

    it("returns 404 when user is not found in database", async () => {
      prisma.default.user.findUnique.mockResolvedValue(null);

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(404);
    });

    it("queries user by authenticated userId", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);

      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
        })
      );
    });
  });

  describe("Token version and session invalidation", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("$2a$10$newhash");
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });
    });

    it("increments tokenVersion on the user record", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        })
      );
    });

    it("deletes all existing sessions for the user", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
        })
      );
    });

    it("sets a new passwordChangedAt timestamp", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordChangedAt: expect.any(Date),
          }),
        })
      );
    });

    it("stores the hashed password in the database", async () => {
      await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(prisma.default.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: "$2a$10$newhash",
          }),
        })
      );
    });

    it("returns success message on completion", async () => {
      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      const body = await response.json();
      expect(body.message).toBeDefined();
      expect(typeof body.message).toBe("string");
    });
  });

  describe("Password content validation", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
    });

    it("rejects password that is exactly 8 characters of only numbers", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "12345678",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });

    it("allows password with mixed case letters and numbers", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "Abcd1234Xy",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });

    it("allows password with spaces in the middle", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "My Password 123",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });

    it("allows password with special characters", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "!@#$%^&*()",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });
  });

  describe("Concurrent request handling", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("$2a$10$newhash");
    });

    it("handles multiple rapid password changes", async () => {
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });

      const results = await Promise.all([
        POST(mockRequest({ newPassword: "Pass1234!", currentPassword: "OldPass123!" })),
        POST(mockRequest({ newPassword: "Pass5678!", currentPassword: "OldPass123!" })),
        POST(mockRequest({ newPassword: "Pass9012!", currentPassword: "OldPass123!" })),
      ]);
      results.forEach((r) => expect(r.status).toBe(200));
    });

    it("each concurrent request hashes independently", async () => {
      bcrypt.hash
        .mockResolvedValueOnce("$2a$10$hash1")
        .mockResolvedValueOnce("$2a$10$hash2")
        .mockResolvedValueOnce("$2a$10$hash3");
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });

      await Promise.all([
        POST(mockRequest({ newPassword: "Pass1234!", currentPassword: "OldPass123!" })),
        POST(mockRequest({ newPassword: "Pass5678!", currentPassword: "OldPass123!" })),
        POST(mockRequest({ newPassword: "Pass9012!", currentPassword: "OldPass123!" })),
      ]);
      expect(bcrypt.hash).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge cases", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
    });

    it("handles user with no email configured", async () => {
      middleware.requireAuth.mockResolvedValue({ userId: 1 });

      prisma.default.user.findUnique.mockResolvedValue({
        id: 1,
        email: null,
        passwordHash: "$2a$10$existinghash",
        tokenVersion: 1,
      });
      bcrypt.compare.mockResolvedValue(true);

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(200);
    });

    it("handles null currentPassword gracefully for password accounts", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: null,
      }));
      expect(response.status).toBe(400);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("handles undefined currentPassword gracefully for password accounts", async () => {
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(400);
    });

    it("handles missing request body gracefully", async () => {
      const emptyRequest = {
        json: () => Promise.resolve({}),
        headers: { get: () => "Bearer token" },
      } as unknown as NextRequest;

      const response = await POST(emptyRequest);
      expect(response.status).toBe(400);
    });

    it("returns error message body on failure", async () => {
      middleware.requireAuth.mockRejectedValue(
        new Error("Something went wrong")
      );

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      getClientIp.mockReturnValue("127.0.0.1");
      middleware.requireAuth.mockResolvedValue(mockUser);
      checkRateLimit.mockResolvedValue({ allowed: true });
      prisma.default.user.findUnique.mockResolvedValue(mockPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("$2a$10$newhash");
      prisma.default.user.update.mockResolvedValue(mockPasswordUser);
      prisma.default.session.deleteMany.mockResolvedValue({ count: 2 });
    });

    it("returns 500 when bcrypt.hash throws", async () => {
      bcrypt.hash.mockRejectedValue(new Error("Hash failure"));

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(500);
    });

    it("returns 500 when prisma transaction fails", async () => {
      prisma.default.$transaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      const response = await POST(mockRequest({
        newPassword: "NewPass123!",
        currentPassword: "OldPass123!",
      }));
      expect(response.status).toBe(500);
    });

    it("returns 500 when JSON parsing fails", async () => {
      const requestWithBadJson = {
        json: () => Promise.reject(new Error("Invalid JSON")),
        headers: {
          get: () => "Bearer token",
        },
      } as unknown as NextRequest;

      const response = await POST(requestWithBadJson);
      expect(response.status).toBe(500);
    });

    it("returns HttpError status code when isHttpError returns true", async () => {
      middleware.requireAuth.mockRejectedValue({ status: 403, message: "Forbidden" });
      middleware.isHttpError.mockReturnValue(true);

      const response = await POST(mockRequest({ newPassword: "NewPass123!" }));
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
    });
  });
});
