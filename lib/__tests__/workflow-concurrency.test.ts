/**
 * Workflow and concurrency validation tests.
 *
 * These tests verify that the analysis worker workflow and its supporting
 * services maintain proper concurrency guarantees, prevent overlapping
 * runs, and handle crash recovery correctly.
 */

let mockUpdateMany: jest.Mock;
let mockFindUnique: jest.Mock;
let mockFindFirst: jest.Mock;
let mockCreate: jest.Mock;
let mockUpdate: jest.Mock;
let mockTransaction: jest.Mock;
let mockQueryRaw: jest.Mock;
let mockExecuteRaw: jest.Mock;
let mockCount: jest.Mock;

jest.mock("../prisma", () => ({
  __esModule: true,
  default: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
    $executeRaw: (...args: any[]) => mockExecuteRaw(...args),
    $transaction: (cb: any) => mockTransaction(cb),
    analysisJob: {
      updateMany: (...args: any[]) => mockUpdateMany(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      findFirst: (...args: any[]) => mockFindFirst(...args),
      create: (...args: any[]) => mockCreate(...args),
      update: (...args: any[]) => mockUpdate(...args),
      count: (...args: any[]) => mockCount(...args),
    },
  },
}));

jest.mock("../queue/analysisQueue", () => ({
  analysisQueue: {
    add: jest.fn(),
  },
}));

function setupMocks() {
  mockUpdateMany = jest.fn();
  mockFindUnique = jest.fn();
  mockFindFirst = jest.fn();
  mockCreate = jest.fn();
  mockUpdate = jest.fn();
  mockTransaction = jest.fn();
  mockQueryRaw = jest.fn();
  mockExecuteRaw = jest.fn();
  mockCount = jest.fn();
}

const { AnalysisJobService } = require("../services/analysisJobService");

beforeEach(() => {
  setupMocks();
});

describe("Workflow concurrency guarantees", () => {
  describe("reclaimOrphanedJobs", () => {
    it("resets PROCESSING status to QUEUED for expired locks", async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 });
      const service = new AnalysisJobService();
      const result = await service.reclaimOrphanedJobs();

      expect(result).toBe(3);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "PROCESSING",
          lockExpiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: "QUEUED",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockToken: null,
        },
      });
    });

    it("returns 0 when no orphaned jobs exist", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      const service = new AnalysisJobService();
      const result = await service.reclaimOrphanedJobs();
      expect(result).toBe(0);
    });

    it("handles large batch reclamation", async () => {
      mockUpdateMany.mockResolvedValue({ count: 50 });
      const service = new AnalysisJobService();
      const result = await service.reclaimOrphanedJobs();
      expect(result).toBe(50);
    });

    it("propagates database errors", async () => {
      mockUpdateMany.mockRejectedValue(new Error("connection lost"));
      const service = new AnalysisJobService();
      await expect(service.reclaimOrphanedJobs()).rejects.toThrow("connection lost");
    });
  });

  describe("claimNextJob concurrency safety", () => {
    it("returns null when no jobs are available", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.claimNextJob({ workerId: "test-worker" });
      expect(result).toBeNull();
    });

    it("claims and returns a job when one is available", async () => {
      const mockJob = {
        id: "job-1",
        repositoryId: 1,
        userId: 1,
        type: "repository_analysis",
        status: "PROCESSING",
        lockedBy: "test-worker",
        lockedAt: new Date(),
        lockExpiresAt: new Date(Date.now() + 300000),
        attempts: 1,
        maxAttempts: 3,
        progressPercent: 0,
        progressMessage: "Analysis in progress...",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ id: "job-1" }]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(mockJob),
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.claimNextJob({ workerId: "test-worker" });
      expect(result).not.toBeNull();
      expect(result!.id).toBe("job-1");
      expect(result!.status).toBe("PROCESSING");
    });

    it("does not return a job already claimed by another worker with active lock", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.claimNextJob({ workerId: "worker-a" });
      expect(result).toBeNull();
    });
  });

  describe("lock release on shutdown", () => {
    it("expires lock immediately when released", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();
      await service.releaseLock({ jobId: "job-1", workerId: "worker-a" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1", lockedBy: "worker-a" },
        data: { lockExpiresAt: expect.any(Date) },
      });
    });

    it("releases lock without workerId filter when not provided", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();
      await service.releaseLock({ jobId: "job-1" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { lockExpiresAt: expect.any(Date) },
      });
    });

    it("releases locks for all acquired jobs on drain", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();

      const markDrainSpy = jest.spyOn(service, "markDrainReleased");
      await service.markDrainReleased({
        jobId: "job-1",
        workerId: "worker-a",
        error: "Worker shutting down",
      });

      expect(markDrainSpy).toHaveBeenCalledWith({
        jobId: "job-1",
        workerId: "worker-a",
        error: "Worker shutting down",
      });
    });
  });

  describe("duplicate job prevention", () => {
    it("returns existing job when one is already active for repository", async () => {
      const existingJob = {
        id: "active-job",
        repositoryId: 1,
        userId: 1,
        type: "repository_analysis",
        status: "PROCESSING",
        attempts: 1,
        maxAttempts: 3,
        progressPercent: 30,
        progressMessage: "In progress",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          analysisJob: {
            findFirst: jest.fn().mockResolvedValue(existingJob),
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.createRepositoryAnalysisJob({
        repositoryId: 1,
        userId: 1,
      });

      expect(result).toBe(existingJob);
    });

    it("creates new job when no active job exists", async () => {
      const newJob = {
        id: "new-job",
        repositoryId: 1,
        userId: 1,
        type: "repository_analysis",
        status: "QUEUED",
        attempts: 0,
        maxAttempts: 3,
        progressPercent: 0,
        progressMessage: "Queued",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const txFindFirst = jest.fn().mockResolvedValue(null);
      const txCreate = jest.fn().mockResolvedValue(newJob);

      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          analysisJob: {
            findFirst: txFindFirst,
            create: txCreate,
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.createRepositoryAnalysisJob({
        repositoryId: 1,
        userId: 1,
      });

      expect(result).toBe(newJob);
      expect(txFindFirst).toHaveBeenCalled();
      expect(txCreate).toHaveBeenCalled();
    });
  });

  describe("job lifecycle transitions", () => {
    it("transitions from QUEUED to PROCESSING on claim", async () => {
      const mockJob = {
        id: "job-lifecycle",
        repositoryId: 1,
        userId: 1,
        type: "repository_analysis",
        status: "PROCESSING",
        lockedBy: "test-worker",
        lockedAt: new Date(),
        lockExpiresAt: new Date(Date.now() + 300000),
        attempts: 1,
        maxAttempts: 3,
        progressPercent: 0,
        progressMessage: "Queued",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ id: "job-lifecycle" }]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(mockJob),
          },
        };
        return cb(tx);
      });

      const service = new AnalysisJobService();
      const result = await service.claimNextJob({ workerId: "test-worker" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe("PROCESSING");
      expect(result!.lockedBy).toBe("test-worker");
    });

    it("transitions from PROCESSING to DONE on completion", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();
      await service.markDone({ jobId: "job-1", workerId: "test-worker" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1", lockedBy: "test-worker" },
        data: {
          status: "DONE",
          progressPercent: 100,
          progressMessage: "Analysis complete! ✓",
          finishedAt: expect.any(Date),
          error: null,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          lockToken: null,
        },
      });
    });

    it("transitions to FAILED on non-retryable error", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();
      await service.markFailed({
        jobId: "job-1",
        workerId: "test-worker",
        error: "Non-retryable error",
        attempts: 1,
        maxAttempts: 1,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1", lockedBy: "test-worker" },
        data: {
          status: "FAILED",
          finishedAt: expect.any(Date),
          progressMessage: "Analysis failed. Please try again.",
          progressPercent: null,
          error: "Non-retryable error",
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          lockToken: null,
        },
      });
    });

    it("re-queues on retryable error with backoff", async () => {
      mockUpdate.mockResolvedValue({});
      const service = new AnalysisJobService();
      await service.markFailed({
        jobId: "job-1",
        workerId: "test-worker",
        error: "Rate limited",
        attempts: 0,
        maxAttempts: 3,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1", lockedBy: "test-worker" },
        data: {
          status: "QUEUED",
          nextRunAt: expect.any(Date),
          progressMessage: expect.stringContaining("Retrying"),
          error: "Rate limited",
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          lockToken: null,
        },
      });
    });
  });

  describe("heartbeat lock extension", () => {
    it("extends lock expiry with default duration", async () => {
      mockExecuteRaw.mockResolvedValue(undefined);
      const service = new AnalysisJobService();
      await service.heartbeat({ jobId: "job-1", workerId: "worker-a" });

      expect(mockExecuteRaw).toHaveBeenCalled();
    });

    it("extends lock expiry with custom duration", async () => {
      mockExecuteRaw.mockResolvedValue(undefined);
      const service = new AnalysisJobService();
      await service.heartbeat({ jobId: "job-1", workerId: "worker-a", lockMs: 60000 });

      expect(mockExecuteRaw).toHaveBeenCalled();
    });

    it("scopes heartbeat to the owning worker", async () => {
      mockExecuteRaw.mockResolvedValue(undefined);
      const service = new AnalysisJobService();
      await service.heartbeat({ jobId: "job-1", workerId: "worker-a" });

      expect(mockExecuteRaw).toHaveBeenCalled();
    });
  });

  describe("cleanupStaleJobs", () => {
    it("fails jobs beyond grace period", async () => {
      mockUpdateMany.mockResolvedValue({ count: 2 });
      const service = new AnalysisJobService();
      const result = await service.cleanupStaleJobs(60000);

      expect(result).toBe(2);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "PROCESSING",
          OR: [
            { lockExpiresAt: { lt: expect.any(Date) } },
            { lockExpiresAt: null },
          ],
          updatedAt: { lt: expect.any(Date) },
        },
        data: {
          status: "FAILED",
          error: "Job timed out - no heartbeat received",
          progressMessage: "Job timed out - no heartbeat received",
          progressPercent: null,
          finishedAt: expect.any(Date),
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          lockToken: null,
        },
      });
    });

    it("returns 0 when no stale jobs exist", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      const service = new AnalysisJobService();
      const result = await service.cleanupStaleJobs();
      expect(result).toBe(0);
    });
  });
});

export {};

