import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireAuth, HttpError } from "@/lib/middleware";

const mockFindUnique = jest.fn();
const mockTokenVersionCache = new Map<string, { version: number; fetchedAt: number }>();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

jest.mock("@/lib/config/env", () => ({
  getNextAuthSecret: jest.fn(() => "test-secret"),
}));

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    verifyTokenWithUserValidation: jest.fn(),
  };
});

const { getToken } = require("next-auth/jwt");
const { verifyTokenWithUserValidation } = require("@/lib/auth");

function mockRequest(authHeader?: string): NextRequest {
  const cookies = new Map<string, string>();
  return {
    headers: {
      get: (name: string) => (name === "authorization" ? authHeader || null : null),
    },
    cookies: {
      get: (name: string) => cookies.get(name) || undefined,
      delete: (name: string) => { cookies.delete(name); },
      set: (name: string, value: string) => { cookies.set(name, value); },
    },
  } as unknown as NextRequest;
}

describe("getAuthUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenVersionCache.clear();
  });

  describe("JWT Bearer auth", () => {
    it("returns user payload for valid JWT token", async () => {
      verifyTokenWithUserValidation.mockResolvedValue({
        userId: 1,
        email: "test@test.com",
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 1,
        lockedUntil: null,
      });

      const result = await getAuthUser(mockRequest("Bearer valid-token"));
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(1);
    });

    it("returns null when JWT tokenVersion mismatches DB", async () => {
      verifyTokenWithUserValidation.mockResolvedValue({
        userId: 1,
        email: "test@test.com",
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 2,
        lockedUntil: null,
      });

      const result = await getAuthUser(mockRequest("Bearer old-token"));
      expect(result).toBeNull();
    });

    it("returns null when user is locked", async () => {
      verifyTokenWithUserValidation.mockResolvedValue({
        userId: 1,
        email: "test@test.com",
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 1,
        lockedUntil: new Date(Date.now() + 3600000),
      });

      const result = await getAuthUser(mockRequest("Bearer token"));
      expect(result).toBeNull();
    });

    it("returns null when JWT validation throws", async () => {
      verifyTokenWithUserValidation.mockRejectedValue(new Error("Invalid token"));
      const result = await getAuthUser(mockRequest("Bearer bad-token"));
      expect(result).toBeNull();
    });
  });

  describe("NextAuth session cookie", () => {
    it("returns user payload for valid NextAuth token", async () => {
      getToken.mockResolvedValue({
        sub: "1",
        email: "test@test.com",
        iat: Math.floor(Date.now() / 1000),
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 1,
        passwordChangedAt: null,
        lockedUntil: null,
      });

      const result = await getAuthUser(mockRequest());
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(1);
    });

    it("returns null when NextAuth tokenVersion mismatches", async () => {
      getToken.mockResolvedValue({
        sub: "1",
        email: "test@test.com",
        iat: Math.floor(Date.now() / 1000),
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 2,
        passwordChangedAt: null,
        lockedUntil: null,
      });

      const result = await getAuthUser(mockRequest());
      expect(result).toBeNull();
    });

    it("returns null when passwordChangedAt is after token issuedAt", async () => {
      getToken.mockResolvedValue({
        sub: "1",
        email: "test@test.com",
        iat: Math.floor(Date.now() / 1000) - 3600,
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue({
        id: 1,
        tokenVersion: 1,
        passwordChangedAt: new Date(),
        lockedUntil: null,
      });

      const result = await getAuthUser(mockRequest());
      expect(result).toBeNull();
    });

    it("returns null when token has no sub", async () => {
      getToken.mockResolvedValue({ email: "test@test.com", tokenVersion: 1 });
      const result = await getAuthUser(mockRequest());
      expect(result).toBeNull();
    });

    it("returns null when user is not found in DB", async () => {
      getToken.mockResolvedValue({
        sub: "999",
        email: "ghost@test.com",
        tokenVersion: 1,
      });
      mockFindUnique.mockResolvedValue(null);

      const result = await getAuthUser(mockRequest());
      expect(result).toBeNull();
    });
  });

  it("returns null when no auth is present", async () => {
    getToken.mockResolvedValue(null);
    const result = await getAuthUser(mockRequest());
    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  it("returns user payload when authenticated", async () => {
    verifyTokenWithUserValidation.mockResolvedValue({
      userId: 1,
      email: "test@test.com",
      tokenVersion: 1,
    });
    mockFindUnique.mockResolvedValue({ id: 1, tokenVersion: 1, lockedUntil: null });

    const result = await requireAuth(mockRequest("Bearer token"));
    expect(result.userId).toBe(1);
  });

  it("throws HttpError when not authenticated", async () => {
    getToken.mockResolvedValue(null);
    await expect(requireAuth(mockRequest())).rejects.toThrow(HttpError);
    await expect(requireAuth(mockRequest())).rejects.toThrow("Unauthorized");
  });
});
