import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../../app/api/users/route";
import prisma from "../../../lib/prisma";
import { requireAuth, HttpError } from "../../../lib/middleware";

// Mock the auth middleware
vi.mock("../../../lib/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/middleware")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

// Mock the prisma client
vi.mock("../../../lib/prisma", () => {
  return {
    default: {
      user: {
        findMany: vi.fn(),
      },
    },
    user: {
      findMany: vi.fn(),
    },
  };
});

describe("GET /api/users API Route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 Unauthorized if the user is not authenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new HttpError(401, "Unauthorized"));

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.message).toBe("Unauthorized");
  });

  it("lists users with default pagination when no params are provided", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: "test@example.com" });
    
    const mockUsers = [
      { id: 1, name: "Alice", email: "alice@example.com", image: null, createdAt: new Date() },
      { id: 2, name: "Bob", email: "bob@example.com", image: null, createdAt: new Date() },
    ];
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers as any);

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    // Verify db parameters
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      take: 21, // limit 20 + 1 sentinel
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    });

    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 20,
    });
  });

  it("filters with cursor and clamps limit parameters when provided", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: "test@example.com" });

    // Mock returning more than the limit (sentinel) to trigger hasMore
    const mockUsers = [
      { id: 11, name: "Alice", email: "alice@example.com", image: null, createdAt: new Date() },
      { id: 12, name: "Bob", email: "bob@example.com", image: null, createdAt: new Date() },
      { id: 13, name: "Charlie", email: "charlie@example.com", image: null, createdAt: new Date() }, // sentinel
    ];
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers as any);

    const request = new NextRequest("http://localhost:3000/api/users?limit=2&cursor=10");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    // Verify database query parameters matching the cursor and limit
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      take: 3, // limit 2 + 1 sentinel
      where: { id: { gt: 10 } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    });

    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe(11);
    expect(body.data[1].id).toBe(12);
    expect(body.pagination).toEqual({
      nextCursor: 12,
      hasMore: true,
      limit: 2,
    });
  });

  it("returns 500 when database query fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: 1, email: "test@example.com" });
    vi.mocked(prisma.user.findMany).mockRejectedValueOnce(new Error("Database connection lost"));

    const request = new NextRequest("http://localhost:3000/api/users");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe("Failed to list users");
  });
});
