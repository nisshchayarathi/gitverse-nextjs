/**
 * @jest-environment node
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  isHttpError: jest.fn((error) => typeof error?.status === "number"),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    repository: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/annotationSync", () => ({
  addClient: jest.fn(),
  removeClient: jest.fn(),
}));

const { NextRequest } = require("next/server");
const { GET } = require("../route");
const { requireAuth } = require("@/lib/middleware");
const { prisma } = require("@/lib/prisma");
const { addClient } = require("@/lib/services/annotationSync");

describe("GET /api/annotations/sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      userId: 123,
      email: "test@example.com",
    });
    (prisma.repository.findFirst as jest.Mock).mockResolvedValue({ id: 456 });
  });

  function createRequest(repositoryId?: string) {
    const url = new URL("http://localhost/api/annotations/sync");
    if (repositoryId !== undefined) {
      url.searchParams.set("repositoryId", repositoryId);
    }
    return new NextRequest(url);
  }

  it("requires authentication before opening the SSE stream", async () => {
    (requireAuth as jest.Mock).mockRejectedValue({
      status: 401,
      message: "Unauthorized",
    });

    const response = await GET(createRequest("456"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(prisma.repository.findFirst).not.toHaveBeenCalled();
    expect(addClient).not.toHaveBeenCalled();
  });

  it("rejects invalid repository IDs before opening the stream", async () => {
    const response = await GET(createRequest("abc"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid repositoryId");
    expect(prisma.repository.findFirst).not.toHaveBeenCalled();
    expect(addClient).not.toHaveBeenCalled();
  });

  it("rejects repositories that do not belong to the authenticated user", async () => {
    (prisma.repository.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(createRequest("456"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Repository not found or access denied");
    expect(prisma.repository.findFirst).toHaveBeenCalledWith({
      where: { id: 456, userId: 123 },
      select: { id: true },
    });
    expect(addClient).not.toHaveBeenCalled();
  });

  it("opens the SSE stream only after repository ownership is verified", async () => {
    const response = await GET(createRequest("456"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(prisma.repository.findFirst).toHaveBeenCalledWith({
      where: { id: 456, userId: 123 },
      select: { id: true },
    });
    expect(addClient).toHaveBeenCalledWith(
      "456",
      expect.objectContaining({ id: expect.any(String) }),
    );
  });
});
