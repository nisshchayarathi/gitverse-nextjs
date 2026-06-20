import { NextRequest } from "next/server";
import { DELETE, GET } from "../route";

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    session: {
      findMany: (...args: any[]) => mockFindMany(...args),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/middleware", () => ({
  getAuthUser: jest.fn(),
  sanitizeError: jest.fn((e: any) => String(e)),
}));

const { getAuthUser } = require("@/lib/middleware");

function mockRequest(authHeader?: string, params?: { cursor?: string; limit?: string }): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/sessions");
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.limit) url.searchParams.set("limit", params.limit);
  return {
    url: url.toString(),
    headers: {
      get: (name: string) => (name === "authorization" ? authHeader || null : null),
    },
  } as unknown as NextRequest;
}

describe("DELETE /api/auth/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await DELETE(mockRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("increments tokenVersion and updates passwordChangedAt", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockUpdate.mockResolvedValue({ id: 1, tokenVersion: 3 });

    const response = await DELETE(mockRequest("Bearer valid-token"));
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
    const body = await response.json();
    expect(body.message).toContain("terminated");
  });

  it("returns 500 on prisma error", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockUpdate.mockRejectedValue(new Error("DB error"));

    const response = await DELETE(mockRequest("Bearer token"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to terminate sessions");
  });
});

describe("GET /api/auth/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    getAuthUser.mockResolvedValue(null);
    const response = await GET(mockRequest());
    expect(response.status).toBe(401);
  });

  it("returns list of sessions", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockFindMany.mockResolvedValue([
      { id: "s1", expires: new Date(), userId: 1 },
      { id: "s2", expires: new Date(), userId: 1 },
    ]);

    const response = await GET(mockRequest("Bearer token"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeUndefined();
  });

  it("respects limit parameter", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      expires: new Date(Date.now() + i * 3600000),
      userId: 1,
    }));
    mockFindMany.mockResolvedValue(sessions);

    const response = await GET(mockRequest("Bearer token", { limit: "3" }));
    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4 }),
    );
  });

  it("clamps limit to maximum of 50", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockFindMany.mockResolvedValue([]);

    await GET(mockRequest("Bearer token", { limit: "100" }));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 }),
    );
  });

  it("handles cursor-based pagination", async () => {
    getAuthUser.mockResolvedValue({ userId: 1, email: "test@test.com" });
    mockFindMany.mockResolvedValue([
      { id: "s3", expires: new Date(), userId: 1 },
    ]);

    await GET(mockRequest("Bearer token", { cursor: "s2" }));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "s2" },
        skip: 1,
      }),
    );
  });
});
