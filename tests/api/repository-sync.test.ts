import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositorySyncQueue } from "../../lib/services/repositorySyncQueue";
import { RepositorySyncService } from "../../lib/services/repositorySyncService";
import { GithubWebhookVerifier } from "../../lib/services/githubWebhookVerifier";

// Mock dependencies
vi.mock("../../lib/prisma", () => ({
  default: {
    repositorySyncJob: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    repository: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  }
}));

vi.mock("../../lib/services/githubService", () => {
  return {
    GitHubService: vi.fn().mockImplementation(() => ({
      getCommits: vi.fn().mockResolvedValue([{ sha: "fake-sha" }])
    }))
  }
});

vi.mock("../../lib/services/dependencyGraphAnalyzer", () => ({
  DependencyGraphAnalyzer: {
    analyzeImpact: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock("../../lib/services/repositoryKnowledgeService", () => ({
  repositoryKnowledgeService: {
    refreshKnowledge: vi.fn().mockResolvedValue(true)
  }
}));

import prisma from "../../lib/prisma";
import crypto from "crypto";
import { NextRequest } from "next/server";

describe("Real-time Repository Synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
  });

  describe("Webhook Security", () => {
    it("rejects invalid webhook signatures", async () => {
      const rawBody = JSON.stringify({ action: "push" });
      const badSignature = "sha256=invalid_hash";
      
      const mockRequest = {
        headers: new Headers({ "x-hub-signature-256": badSignature })
      } as unknown as NextRequest;

      const isValid = await GithubWebhookVerifier.verifySignature(mockRequest, rawBody);
      expect(isValid).toBe(false);
    });

    it("accepts valid webhook signatures", async () => {
      const rawBody = JSON.stringify({ action: "push" });
      const hmac = crypto.createHmac("sha256", "test-secret");
      hmac.update(rawBody, "utf8");
      const goodSignature = `sha256=${hmac.digest("hex")}`;
      
      const mockRequest = {
        headers: new Headers({ "x-hub-signature-256": goodSignature })
      } as unknown as NextRequest;

      const isValid = await GithubWebhookVerifier.verifySignature(mockRequest, rawBody);
      expect(isValid).toBe(true);
    });
  });

  describe("Event Processing Queue", () => {
    it("enqueues a new sync job successfully", async () => {
      (prisma.repositorySyncJob.findFirst as any).mockResolvedValue(null);
      (prisma.repositorySyncJob.create as any).mockResolvedValue({ id: "job-1" });

      const enqueued = await RepositorySyncQueue.enqueueSyncJob(1, "push");
      expect(enqueued).toBe(true);
      expect(prisma.repositorySyncJob.create).toHaveBeenCalledWith({
        data: {
          repositoryId: 1,
          eventType: "push",
          status: "QUEUED"
        }
      });
    });

    it("deduplicates rapid push events", async () => {
      // Simulate an existing queued job
      (prisma.repositorySyncJob.findFirst as any).mockResolvedValue({ id: "existing-job" });

      const enqueued = await RepositorySyncQueue.enqueueSyncJob(1, "push");
      expect(enqueued).toBe(false); // Should be deduplicated
      expect(prisma.repositorySyncJob.create).not.toHaveBeenCalled();
    });
  });

  describe("Repository Sync Service", () => {
    it("processes a sync job successfully", async () => {
      (prisma.repository.findUnique as any).mockResolvedValue({
        id: 1,
        url: "https://github.com/test-owner/test-repo"
      });

      await RepositorySyncService.processSyncJob("job-1", 1, "mock-token");

      expect(prisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { status: "PROCESSING", startedAt: expect.any(Date) }
      });

      expect(prisma.repository.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          lastSynchronizedAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      });

      expect(prisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { status: "COMPLETED", completedAt: expect.any(Date) }
      });
    });

    it("handles worker failures with retry mechanism", async () => {
      (prisma.repository.findUnique as any).mockResolvedValue(null); // Will throw error "Repository not found"

      await RepositorySyncService.processSyncJob("job-2", 99, "mock-token");

      expect(prisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "job-2" },
        data: { status: "FAILED", completedAt: expect.any(Date), errorMessage: "Repository not found" }
      });
    });
  });
});
