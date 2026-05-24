jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      headers: init?.headers || {},
      json: async () => data,
    }),
  },
}));

import { GET as getRepositories, POST } from "../../app/api/repositories/route";
import {
  GET as getRepositoryById,
  DELETE,
} from "../../app/api/repositories/[id]/route";

import { NextRequest } from "next/server";

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  isHttpError: jest.fn(() => false),
  sanitizeError: jest.fn((e) => e),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    createRepository: jest.fn(),
    listRepositories: jest.fn(),
    getRepository: jest.fn(),
    deleteRepository: jest.fn(),
  },
}));

jest.mock("@/lib/services/analysisJobService", () => ({
  analysisJobService: {
    createRepositoryAnalysisJob: jest.fn(),
  },
}));

jest.mock("@/lib/services/analysisWorkerTriggerService", () => ({
  triggerAnalysisWorkerWorkflow: jest.fn(),
}));

jest.mock("@/lib/utils/repositoryUtils", () => ({
  normalizeKnownRepoHttpUrl: jest.fn((url) => url),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    analysisJob: {
      findFirst: jest.fn(),
    },
  },
}));

const { requireAuth } = require("@/lib/middleware");
const { repositoryService } = require("@/lib/services/repositoryService");
const { analysisJobService } = require("@/lib/services/analysisJobService");

describe("Repositories API", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    requireAuth.mockResolvedValue({
      userId: 1,
    });
  });

  describe("POST /api/repositories", () => {
    it("should create repository successfully", async () => {
      repositoryService.createRepository.mockResolvedValue({
        id: 1,
        name: "test-repo",
      });

      analysisJobService.createRepositoryAnalysisJob.mockResolvedValue({
        id: 10,
        status: "pending",
      });

      const request = {
        json: async () => ({
          name: "test-repo",
          url: "https://github.com/test/repo",
          description: "demo",
        }),
        url: "http://localhost:3000/api/repositories",
      } as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.repository.name).toBe("test-repo");
    });

    it("should fail when name/url missing", async () => {
      const request = {
        json: async () => ({
          name: "",
          url: "",
        }),
      } as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/repositories", () => {
    it("should list repositories", async () => {
      repositoryService.listRepositories.mockResolvedValue([
        { id: 1, name: "repo1" },
      ]);

      const request = {} as NextRequest;

      const response = await getRepositories(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.repositories.length).toBe(1);
    });
  });

  describe("GET /api/repositories/[id]", () => {
    it("should fetch repository by id", async () => {
      repositoryService.getRepository.mockResolvedValue({
        id: 1,
        name: "repo1",
      });

      const request = {} as NextRequest;

      const response = await getRepositoryById(request, {
        params: { id: "1" },
      });

      expect(response.status).toBe(200);
    });

    it("should reject invalid id", async () => {
      const request = {} as NextRequest;

      const response = await getRepositoryById(request, {
        params: { id: "abc" },
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/repositories/[id]", () => {
    it("should delete repository", async () => {
      repositoryService.deleteRepository.mockResolvedValue(true);

      const request = {} as NextRequest;

      const response = await DELETE(request, {
        params: { id: "1" },
      });

      expect(response.status).toBe(200);
    });
  });
});