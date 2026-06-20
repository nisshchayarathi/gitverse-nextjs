/**
 * @jest-environment node
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((error) => error?.message || "Unknown error"),
  isHttpError: jest.fn(() => false),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn(),
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    repositoryKnowledge: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/analysisJobService", () => ({
  analysisJobService: {
    createArchitectureGenerationJob: jest.fn(),
  },
}));

jest.mock("@/lib/services/analysisWorkerTriggerService", () => ({
  triggerAnalysisWorkerWorkflow: jest.fn(),
}));

jest.mock("@/lib/middleware/rateLimit", () => ({
  checkRateLimit: jest.fn(),
  rateLimitResponse: jest.fn(),
  RATE_LIMITS: {
    REPOSITORY_ARCHITECTURE: {},
  },
}));

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { GET } from "../route";

describe("GET /api/repositories/[id]/generate-architecture", () => {
  const user = { userId: 123, email: "owner@example.com" };
  const repository = { id: 42, userId: user.userId };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(user);
    (repositoryService.getRepository as jest.Mock).mockResolvedValue(
      repository,
    );
  });

  function createRequest(id: string) {
    return new NextRequest(
      `http://localhost/api/repositories/${id}/generate-architecture`,
    );
  }

  it("rejects invalid repository IDs before querying repository data", async () => {
    const response = await GET(createRequest("42abc"), {
      params: { id: "42abc" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid repository ID format",
    });
    expect(repositoryService.getRepository).not.toHaveBeenCalled();
    expect(prisma.repositoryKnowledge.findUnique).not.toHaveBeenCalled();
  });

  it("does not expose architecture documents for inaccessible repositories", async () => {
    (repositoryService.getRepository as jest.Mock).mockResolvedValue(null);

    const response = await GET(createRequest("42"), { params: { id: "42" } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Repository not found" });
    expect(repositoryService.getRepository).toHaveBeenCalledWith(
      42,
      user.userId,
    );
    expect(prisma.repositoryKnowledge.findUnique).not.toHaveBeenCalled();
  });

  it("returns the architecture document for an owned repository", async () => {
    (prisma.repositoryKnowledge.findUnique as jest.Mock).mockResolvedValue({
      projectDescription: "# Architecture",
    });

    const response = await GET(createRequest("42"), { params: { id: "42" } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Architecture");
    expect(response.headers.get("Content-Type")).toBe("text/markdown");
    expect(repositoryService.getRepository).toHaveBeenCalledWith(
      42,
      user.userId,
    );
    expect(prisma.repositoryKnowledge.findUnique).toHaveBeenCalledWith({
      where: { repositoryId: 42 },
    });
  });

  it("returns 404 when an owned repository has no architecture document", async () => {
    (prisma.repositoryKnowledge.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    const response = await GET(createRequest("42"), { params: { id: "42" } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Architecture document not found or still generating",
    });
  });
});
