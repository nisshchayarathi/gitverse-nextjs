import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/middleware", () => ({
  getAuthUser: jest.fn(),
  sanitizeError: jest.fn((e) => String(e)),
}));

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

jest.mock("@/lib/config/env", () => ({
  getNextAuthSecret: jest.fn(() => "test-secret"),
}));

jest.mock("@/lib/utils/authCookie", () => ({
  appendClearCookieHeaders: jest.fn(),
}));

const prisma = require("@/lib/prisma").default;
const { getAuthUser } = require("@/lib/middleware");
const { getToken } = require("next-auth/jwt");
const { appendClearCookieHeaders } = require("@/lib/utils/authCookie");

function mockRequest(authHeader?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "authorization" ? authHeader || null : null),
    },
  } as unknown as NextRequest;
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await POST(mockRequest("Bearer token"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid or expired authentication token");
  });

  it("increments tokenVersion and updates passwordChangedAt for JWT auth", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    prisma.user.update.mockResolvedValue({ id: 1, tokenVersion: 2 });

    const response = await POST(mockRequest("Bearer valid-jwt"));
    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("clears NextAuth cookies when session cookie is used", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    prisma.user.update.mockResolvedValue({ id: 1, tokenVersion: 2 });
    getToken.mockResolvedValue({ sub: "1", email: "test@test.com" });

    const response = await POST(mockRequest());
    expect(response.status).toBe(200);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    expect(appendClearCookieHeaders).toHaveBeenCalled();
  });

  it("skips cookie clearing when auth header is Bearer JWT", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    prisma.user.update.mockResolvedValue({ id: 1, tokenVersion: 2 });

    await POST(mockRequest("Bearer valid-jwt"));
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(appendClearCookieHeaders).not.toHaveBeenCalled();
  });

  it("skips cookie clearing when getToken returns null", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    prisma.user.update.mockResolvedValue({ id: 1, tokenVersion: 2 });
    getToken.mockResolvedValue(null);

    await POST(mockRequest());
    expect(appendClearCookieHeaders).not.toHaveBeenCalled();
  });

  it("returns 500 on prisma error", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    prisma.user.update.mockRejectedValue(new Error("DB error"));

    const response = await POST(mockRequest("Bearer token"));
    expect(response.status).toBe(500);
  });
});
