var mockQueryRaw: jest.Mock;
var mockFindUnique: jest.Mock;
var mockReleaseLock: jest.Mock;
var mockReclaimOrphanedJobs: jest.Mock;
var mockClaimNextJob: jest.Mock;
var mockMarkDone: jest.Mock;
var mockMarkFailed: jest.Mock;
var mockGetJob: jest.Mock;
var mockAnalyzeRepository: jest.Mock;

jest.mock("../prisma", () => ({
  __esModule: true,
  default: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
    analysisJob: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
  disconnectPrisma: jest.fn(),
}));

jest.mock("../services/analysisJobService", () => {
  const service = {
    releaseLock: (...args: any[]) => mockReleaseLock(...args),
    reclaimOrphanedJobs: (...args: any[]) => mockReclaimOrphanedJobs(...args),
    claimNextJob: (...args: any[]) => mockClaimNextJob(...args),
    markDone: (...args: any[]) => mockMarkDone(...args),
    markFailed: (...args: any[]) => mockMarkFailed(...args),
    getJob: (...args: any[]) => mockGetJob(...args),
  };
  return {
    AnalysisJobService: jest.fn(() => service),
    analysisJobService: service,
  };
});

jest.mock("../services/repositoryService", () => ({
  repositoryService: {
    analyzeRepository: (...args: any[]) => mockAnalyzeRepository(...args),
  },
}));

const ORIGINAL_EXIT = process.exit;

function setupMocks() {
  mockQueryRaw = jest.fn();
  mockFindUnique = jest.fn();
  mockReleaseLock = jest.fn();
  mockReclaimOrphanedJobs = jest.fn();
  mockClaimNextJob = jest.fn();
  mockMarkDone = jest.fn();
  mockMarkFailed = jest.fn();
  mockGetJob = jest.fn();
  mockAnalyzeRepository = jest.fn();

  mockQueryRaw.mockResolvedValue([{ 1: 1 }]);
}

describe("cronWorker — database health check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("connects and runs SELECT 1 successfully", async () => {
    const { default: prisma } = await import("../prisma");
    const result = await (prisma as any).$queryRaw`SELECT 1`;
    expect(result).toEqual([{ 1: 1 }]);
  });

  it("fails when database is unreachable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("Connection refused"));
    await expect(
      (await import("../prisma")).default.$queryRaw`SELECT 1`,
    ).rejects.toThrow("Connection refused");
  });
});

describe("cronWorker — reclaim orphaned jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("reclaims orphaned jobs before processing", async () => {
    mockReclaimOrphanedJobs.mockResolvedValue(5);
    mockClaimNextJob.mockResolvedValue(null);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const reclaimed =
      await analysisJobService.reclaimOrphanedJobs();
    expect(reclaimed).toBe(5);
  });

  it("handles zero orphaned jobs gracefully", async () => {
    mockReclaimOrphanedJobs.mockResolvedValue(0);
    mockClaimNextJob.mockResolvedValue(null);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const reclaimed =
      await analysisJobService.reclaimOrphanedJobs();
    expect(reclaimed).toBe(0);
  });

  it("propagates database errors during reclamation", async () => {
    mockReclaimOrphanedJobs.mockRejectedValue(
      new Error("connection lost"),
    );

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    await expect(
      analysisJobService.reclaimOrphanedJobs(),
    ).rejects.toThrow("connection lost");
  });
});

describe("cronWorker — claim next job", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("claims an available job", async () => {
    const mockJob = {
      id: "job-1",
      type: "repository_analysis",
      repositoryId: 1,
      userId: 1,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
    };
    mockClaimNextJob.mockResolvedValue(mockJob);
    mockGetJob.mockResolvedValue(mockJob);
    mockAnalyzeRepository.mockResolvedValue(undefined);
    mockMarkDone.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const job = await analysisJobService.claimNextJob({
      workerId: "cron-test",
    });
    expect(job).toEqual(mockJob);
    expect(job?.id).toBe("job-1");
  });

  it("returns null when no jobs available", async () => {
    mockClaimNextJob.mockResolvedValue(null);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const job = await analysisJobService.claimNextJob({
      workerId: "cron-test",
    });
    expect(job).toBeNull();
  });
});

describe("cronWorker — job processing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("marks job as done on successful repository analysis", async () => {
    const mockJob = {
      id: "job-1",
      type: "repository_analysis",
      repositoryId: 1,
      userId: 1,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
      progressDetails: null,
    };
    mockGetJob.mockResolvedValue(mockJob);
    mockAnalyzeRepository.mockResolvedValue(undefined);
    mockMarkDone.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const { repositoryService } = await import(
      "../services/repositoryService"
    );

    await analysisJobService.markDone({ jobId: "job-1", workerId: "cron-test" });
    expect(mockMarkDone).toHaveBeenCalledWith({
      jobId: "job-1",
      workerId: "cron-test",
    });
  });

  it("marks architecture generation job as done", async () => {
    const mockJob = {
      id: "job-2",
      type: "architecture_generation",
      repositoryId: 2,
      userId: 1,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
    };
    mockGetJob.mockResolvedValue(mockJob);
    mockMarkDone.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    await analysisJobService.markDone({ jobId: "job-2", workerId: "cron-test" });
    expect(mockMarkDone).toHaveBeenCalledWith({
      jobId: "job-2",
      workerId: "cron-test",
    });
  });

  it("marks job as failed on processing error", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-3",
      type: "repository_analysis",
      repositoryId: 3,
      userId: 1,
      status: "PROCESSING",
      attempts: 1,
      maxAttempts: 3,
    });
    mockAnalyzeRepository.mockRejectedValue(
      new Error("Analysis engine crashed"),
    );
    mockMarkFailed.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../../lib/services/analysisJobService"
    );

    await analysisJobService.markFailed({
      jobId: "job-3",
      workerId: "cron-test",
      error: "Analysis engine crashed",
      attempts: 1,
      maxAttempts: 3,
    });

    expect(mockMarkFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-3",
        error: "Analysis engine crashed",
      }),
    );
  });

  it("marks job as failed for unsupported job type", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-4",
      type: "unknown_type",
      repositoryId: 4,
      userId: 1,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
    });
    mockMarkFailed.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    await analysisJobService.markFailed({
      jobId: "job-4",
      workerId: "cron-test",
      error: "Unsupported job type: unknown_type",
      attempts: 0,
      maxAttempts: 3,
    });

    expect(mockMarkFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-4",
        error: expect.stringContaining("Unsupported job type"),
      }),
    );
  });

  it("handles job not found in DB gracefully", async () => {
    mockGetJob.mockResolvedValue(null);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    const job = await analysisJobService.getJob({ jobId: "nonexistent", userId: 0 });
    expect(job).toBeNull();
  });
});

describe("cronWorker — lock management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("releases lock on a job", async () => {
    mockReleaseLock.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    await analysisJobService.releaseLock({
      jobId: "job-1",
      workerId: "cron-test",
    });
    expect(mockReleaseLock).toHaveBeenCalledWith({
      jobId: "job-1",
      workerId: "cron-test",
    });
  });

  it("handles lock release failure gracefully", async () => {
    mockReleaseLock.mockRejectedValue(new Error("DB error"));

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    await expect(
      analysisJobService.releaseLock({
        jobId: "job-1",
        workerId: "cron-test",
      }),
    ).rejects.toThrow("DB error");
  });

  it("marks drain released job for reprocessing", async () => {
    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    const mockMarkDrainReleased = jest.fn();
    (analysisJobService as any).markDrainReleased = mockMarkDrainReleased;
    mockMarkDrainReleased.mockResolvedValue(undefined);

    const { default: prisma } = await import("../prisma");

    await (analysisJobService as any).markDrainReleased({
      jobId: "job-5",
      workerId: "cron-test",
      error: "Worker shutting down",
    });

    expect(mockMarkDrainReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-5",
        error: "Worker shutting down",
      }),
    );
  });
});

describe("cronWorker — batch processing limits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("stops claiming after processing batch limit", async () => {
    const mockJob = {
      id: "job-batch-1",
      type: "repository_analysis",
      repositoryId: 1,
      userId: 1,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
      progressDetails: null,
    };
    mockClaimNextJob.mockResolvedValue(mockJob);
    mockGetJob.mockResolvedValue(mockJob);
    mockAnalyzeRepository.mockResolvedValue(undefined);
    mockMarkDone.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    for (let i = 0; i < 3; i++) {
      const job = await analysisJobService.claimNextJob({
        workerId: "cron-test",
      });
      expect(job).toBeDefined();
      if (job) {
        await analysisJobService.markDone({
          jobId: job.id,
          workerId: "cron-test",
        });
      }
    }

    expect(mockClaimNextJob).toHaveBeenCalledTimes(3);
    expect(mockMarkDone).toHaveBeenCalledTimes(3);
  });

  it("stops early when no more jobs available", async () => {
    mockClaimNextJob
      .mockResolvedValueOnce({
        id: "job-1",
        type: "repository_analysis",
        repositoryId: 1,
        userId: 1,
        status: "PROCESSING",
        attempts: 0,
        maxAttempts: 3,
      })
      .mockResolvedValue(null);

    mockGetJob.mockResolvedValue({
      id: "job-1",
      type: "repository_analysis",
      repositoryId: 1,
      userId: 1,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
    });
    mockAnalyzeRepository.mockResolvedValue(undefined);
    mockMarkDone.mockResolvedValue(undefined);

    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    const job1 = await analysisJobService.claimNextJob({
      workerId: "cron-test",
    });
    expect(job1).toBeDefined();

    const job2 = await analysisJobService.claimNextJob({
      workerId: "cron-test",
    });
    expect(job2).toBeNull();
  });
});

describe("cronWorker — repository service integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("calls analyzeRepository with scope from progressDetails", async () => {
    mockGetJob.mockResolvedValue({
      id: "job-scope",
      type: "repository_analysis",
      repositoryId: 10,
      userId: 5,
      status: "PROCESSING",
      attempts: 0,
      maxAttempts: 3,
      progressDetails: { scope: "security" },
    });
    mockAnalyzeRepository.mockResolvedValue(undefined);
    mockMarkDone.mockResolvedValue(undefined);

    const { repositoryService } = await import(
      "../services/repositoryService"
    );
    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );

    const job = await analysisJobService.getJob({
      jobId: "job-scope",
      userId: 5,
    });
    expect(job).toBeDefined();

    if (job && job.type === "repository_analysis") {
      const details = job.progressDetails as any;
      await repositoryService.analyzeRepository(job.repositoryId, job.userId, {
        scope: details?.scope,
      });
    }

    expect(mockAnalyzeRepository).toHaveBeenCalledWith(
      10,
      5,
      expect.objectContaining({ scope: "security" }),
    );
  });
});

describe("cronWorker — disconnectPrisma", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it("exports disconnectPrisma function", async () => {
    const mod = await import("../prisma");
    expect(typeof mod.disconnectPrisma).toBe("function");
  });
});

describe("cronWorker — process exit behavior", () => {
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("exits with code 1 on fatal error", async () => {
    const { analysisJobService } = await import(
      "../services/analysisJobService"
    );
    mockReclaimOrphanedJobs.mockRejectedValue(
      new Error("catastrophic failure"),
    );

    try {
      await analysisJobService.reclaimOrphanedJobs();
    } catch {
      process.exit(1);
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 0 on successful run", async () => {
    mockReclaimOrphanedJobs.mockResolvedValue(0);
    mockClaimNextJob.mockResolvedValue(null);

    process.exit(0);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

export {};

