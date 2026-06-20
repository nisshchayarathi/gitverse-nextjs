/**
 * @jest-environment node
 */

var mockEncryptToken: jest.Mock;
var mockValidateEncryptionConfig: jest.Mock;

jest.mock("@/lib/utils/envelopeEncryption", () => {
  mockEncryptToken = jest.fn();
  return {
    encryptToken: mockEncryptToken,
    decryptToken: jest.fn(),
    isTokenEncrypted: jest.fn(),
    checkEncryptionHealth: jest.fn(),
    isKmsConfigured: jest.fn(),
  };
});

jest.mock("@/lib/utils/tokenEncryption", () => {
  mockValidateEncryptionConfig = jest.fn();
  return {
    validateEncryptionConfig: mockValidateEncryptionConfig,
    encryptToken: jest.fn(),
    decryptToken: jest.fn(),
  };
});

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  isHttpError: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    gitHubAccount: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock("@/lib/middleware/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 10, reset: 0 }),
  rateLimitResponse: jest.fn(),
  RATE_LIMITS: { GITHUB_CONNECT: {} },
}));

jest.mock("@/lib/services/githubService", () => ({
  GitHubService: jest.fn().mockImplementation(() => ({
    getAuthenticatedUser: jest.fn(),
  })),
}));

jest.mock("@/services/security/redact-sensitive-fields", () => ({
  RedactSensitiveFields: {
    redact: jest.fn((obj) => obj),
  },
}));

function mockToJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(mockToJsonSafe);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      out[key] = mockToJsonSafe(v);
    }
    return out;
  }
  return value;
}

jest.mock("@/lib/utils/jsonSafe", () => ({
  toJsonSafe: jest.fn(mockToJsonSafe),
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { GitHubService } from "@/lib/services/githubService";
import { NextRequest } from "next/server";

function mockRequest(body: any): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Map(),
  } as unknown as NextRequest;
}

describe("POST /api/integrations/github/connect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateEncryptionConfig.mockReturnValue({ valid: true });
    (requireAuth as jest.Mock).mockResolvedValue({ userId: 42 });
    (prisma.gitHubAccount.upsert as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 42,
      githubUserId: 12345n,
      username: "testuser",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockEncryptToken.mockImplementation(async (token: string) => `encrypted:${token}`);
    (GitHubService as any).mockImplementation(() => ({
      getAuthenticatedUser: jest.fn().mockResolvedValue({ id: 12345, login: "testuser" }),
    }));
  });

  describe("encryption pre-flight check", () => {
    it("returns 503 when encryption key is not configured", async () => {
      mockValidateEncryptionConfig.mockReturnValue({
        valid: false,
        error: "TOKEN_ENCRYPTION_KEY is not set",
      });

      const res = await POST(mockRequest({ token: "gho_test" }));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error).toBe("ENCRYPTION_UNAVAILABLE");
      expect(body.message).toContain("not configured");
    });

    it("returns 503 when encryption key has wrong format", async () => {
      mockValidateEncryptionConfig.mockReturnValue({
        valid: false,
        error: "TOKEN_ENCRYPTION_KEY must be 64 hex characters",
      });

      const res = await POST(mockRequest({ token: "gho_test" }));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error).toBe("ENCRYPTION_UNAVAILABLE");
    });

    it("proceeds with connection when encryption is configured", async () => {
      const res = await POST(mockRequest({ token: "gho_valid_token" }));
      expect(res.status).not.toBe(503);
    });

    it("does not attempt authentication when encryption is unavailable", async () => {
      mockValidateEncryptionConfig.mockReturnValue({
        valid: false,
        error: "TOKEN_ENCRYPTION_KEY is not set",
      });

      await POST(mockRequest({ token: "gho_test" }));

      expect(requireAuth).not.toHaveBeenCalled();
    });
  });

  describe("token validation", () => {
    it("returns 400 when token is missing", async () => {
      const res = await POST(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 when token is empty string", async () => {
      const res = await POST(mockRequest({ token: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when token is whitespace only", async () => {
      const res = await POST(mockRequest({ token: "   " }));
      expect(res.status).toBe(400);
    });
  });

  describe("successful connection", () => {
    it("encrypts the token before storing", async () => {
      const mockGitHubUser = { id: 12345, login: "testuser" };
      (GitHubService as any).mockImplementation(() => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(mockGitHubUser),
      }));

      await POST(mockRequest({ token: "ghp_test_token_123" }));

      expect(mockEncryptToken).toHaveBeenCalledWith("ghp_test_token_123");
    });

    it("stores encrypted token with tokenEncrypted flag", async () => {
      (GitHubService as any).mockImplementation(() => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue({ id: 12345, login: "testuser" }),
      }));

      await POST(mockRequest({ token: "ghp_test" }));

      expect(prisma.gitHubAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accessToken: "encrypted:ghp_test",
            tokenEncrypted: true,
          }),
          update: expect.objectContaining({
            accessToken: "encrypted:ghp_test",
            tokenEncrypted: true,
          }),
        })
      );
    });
  });
});
