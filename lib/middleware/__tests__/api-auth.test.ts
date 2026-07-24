import { NextRequest, NextResponse } from "next/server";
import { requireScopes, authenticateRequest, AuthResult } from "../api-auth";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/utils/api-key", () => ({
  hashApiKey: jest.fn((key: string) => `hashed-${key}`),
  extractBearerToken: jest.fn((header: string | null) => {
    if (!header || !header.startsWith("Bearer ")) return null;
    return header.substring(7);
  }),
}));

import prisma from "@/lib/prisma";
import { getToken } from "next-auth/jwt";

const mockPrisma = jest.mocked(prisma);
const mockGetToken = jest.mocked(getToken);

function createMockRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new NextRequest("https://example.com/api/test", { headers });
}

describe("api-auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireScopes", () => {
    it("returns error when user is not authenticated", () => {
      const authResult: AuthResult = {
        user: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        scopes: [],
      };

      const response = requireScopes(authResult, ["repo:read"]);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(401);
    });

    it("returns null when user has all required scopes", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: ["repo:read", "repo:write"],
      };

      const response = requireScopes(authResult, ["repo:read"]);
      expect(response).toBeNull();
    });

    it("returns 403 when user is missing required scopes", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: ["repo:read"],
      };

      const response = requireScopes(authResult, ["repo:write"]);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);
    });

    it("returns 403 when user has no scopes and scopes are required", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: [],
      };

      const response = requireScopes(authResult, ["repo:read"]);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);
    });

    it("returns null when no scopes are required", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: [],
      };

      const response = requireScopes(authResult, []);
      expect(response).toBeNull();
    });

    it("returns null when user has all multiple required scopes", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: ["repo:read", "repo:write", "admin"],
      };

      const response = requireScopes(authResult, ["repo:read", "repo:write"]);
      expect(response).toBeNull();
    });

    it("returns 403 when user is missing one of multiple required scopes", () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: ["repo:read"],
      };

      const response = requireScopes(authResult, ["repo:read", "repo:write"]);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);
    });

    it("includes required and granted scopes in 403 response body", async () => {
      const authResult: AuthResult = {
        user: { id: 1, email: "test@example.com", name: "Test" },
        error: null,
        scopes: ["repo:read"],
      };

      const response = requireScopes(authResult, ["repo:write", "admin"]);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.error).toBe("Insufficient scopes");
      expect(body.required).toEqual(["repo:write", "admin"]);
      expect(body.granted).toEqual(["repo:read"]);
    });
  });

  describe("authenticateRequest", () => {
    it("returns unauthorized when no auth is provided", async () => {
      mockGetToken.mockResolvedValue(null);
      const request = createMockRequest();

      const result = await authenticateRequest(request);
      expect(result.user).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.scopes).toEqual([]);
    });

    it("authenticates via API key and returns scopes", async () => {
      const mockApiKey = {
        id: 1,
        userId: 1,
        scopes: ["repo:read", "repo:write"],
        expiresAt: new Date(Date.now() + 86400000),
      };
      const mockUser = { id: 1, email: "test@example.com", name: "Test" };

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey as any);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockGetToken.mockResolvedValue(null);

      const request = createMockRequest("Bearer gv_test-key-123");
      const result = await authenticateRequest(request);

      expect(result.user).toEqual(mockUser);
      expect(result.scopes).toEqual(["repo:read", "repo:write"]);
      expect(result.error).toBeNull();
    });

    it("returns empty scopes for session-based auth", async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);
      mockGetToken.mockResolvedValue({
        sub: "1",
        email: "test@example.com",
        name: "Test",
      });

      const request = createMockRequest();
      const result = await authenticateRequest(request);

      expect(result.user).toEqual({ id: 1, email: "test@example.com", name: "Test" });
      expect(result.scopes).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("returns empty scopes when API key has non-array scopes", async () => {
      const mockApiKey = {
        id: 1,
        userId: 1,
        scopes: "invalid",
        expiresAt: new Date(Date.now() + 86400000),
      };
      const mockUser = { id: 1, email: "test@example.com", name: "Test" };

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey as any);
      mockPrisma.apiKey.update.mockResolvedValue({} as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockGetToken.mockResolvedValue(null);

      const request = createMockRequest("Bearer gv_test-key-123");
      const result = await authenticateRequest(request);

      expect(result.scopes).toEqual([]);
    });
  });
});
