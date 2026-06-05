/**
 * @jest-environment node
 */

var mockEncryptToken: jest.Mock;
var mockValidateEncryptionConfig: jest.Mock;

jest.mock("@/lib/utils/tokenEncryption", () => {
  mockEncryptToken = jest.fn();
  mockValidateEncryptionConfig = jest.fn();
  return {
    encryptToken: mockEncryptToken,
    validateEncryptionConfig: mockValidateEncryptionConfig,
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

jest.mock("@/lib/utils/jsonSafe", () => ({
  toJsonSafe: jest.fn((obj) => obj),
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
    mockEncryptToken.mockImplementation((token) => `encrypted:${token}`);
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
