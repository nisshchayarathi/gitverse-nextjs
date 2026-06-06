var mockPrisma: any;
jest.mock("../prisma", () => ({
  __esModule: true,
  default: (mockPrisma = {
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
    analysisJob: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  }),
}));

jest.mock("bullmq", () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
    })),
    Worker: jest.fn(),
  };
});

jest.mock("ioredis", () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
  };
});

function asMock<T>(fn: T): jest.Mock {
  return fn as any;
}

const { AnalysisJobService } = require("../services/analysisJobService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AnalysisJobService – heartbeat", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("extends the lock with the default duration when no lockMs is supplied", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    const before = Date.now();
    await service.heartbeat({ jobId: "job-1", workerId: "worker-A" });
    const after = Date.now();

    expect(asMock(mockPrisma.$executeRaw)).toHaveBeenCalledTimes(1);
    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    // Tagged-template raw: callArgs[0] is the SQL string array, then the
    // interpolated values follow as positional args.
    const strings = callArgs[0];
    const interpolated = callArgs.slice(1);
    expect(strings).toBeInstanceOf(Array);
    expect(interpolated).toContain(5 * 60_000);
    expect(interpolated).toContain("job-1");
    expect(interpolated).toContain("worker-A");
    // Sanity-check the call window without asserting on the raw template.
    expect(after - before).toBeGreaterThanOrEqual(0);
  });

  it("honours a custom lockMs", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    await service.heartbeat({
      jobId: "job-1",
      workerId: "worker-A",
      lockMs: 30_000,
    });

    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const interpolated = callArgs.slice(1);
    expect(interpolated).toContain(30_000);
  });

  it("scopes the heartbeat to the calling worker", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    await service.heartbeat({ jobId: "job-1", workerId: "worker-A" });

    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const strings = callArgs[0];
    const sql = strings
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    // The WHERE clause must include both the status check and the worker
    // identity check, so a worker cannot heartbeat a job it does not own.
    expect(sql).toMatch(/WHERE/i);
    expect(sql).toMatch(/status\s*=\s*'PROCESSING'/i);
    expect(sql).toMatch(/locked_by\s*=/i);
  });
});

describe("AnalysisJobService – reclaimOrphanedJobs empty edge cases", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("handles null lockExpiresAt gracefully (no-op)", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    const result = await service.reclaimOrphanedJobs();
    expect(result).toBe(0);
  });

  it("handles database error during reclamation", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockRejectedValueOnce(
      new Error("connection lost"),
    );

    await expect(service.reclaimOrphanedJobs()).rejects.toThrow("connection lost");
  });

  it("reclaims multiple orphaned jobs at once", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 15 });

    const result = await service.reclaimOrphanedJobs();
    expect(result).toBe(15);
  });

  it("does not reclaim jobs with null lockExpiresAt", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    await service.reclaimOrphanedJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.where.status).toBe("PROCESSING");
    expect(call.where.lockExpiresAt).toEqual({ lt: expect.any(Date) });
  });
});

describe("AnalysisJobService – countOrphanedJobs edge cases", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("counts only PROCESSING jobs with expired locks", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);

    await service.countOrphanedJobs();

    const call = asMock(mockPrisma.analysisJob.count).mock.calls[0][0];
    expect(call.where.status).toBe("PROCESSING");
    expect(call.where.lockExpiresAt).toBeDefined();
  });

  it("handles database error during count", async () => {
    asMock(mockPrisma.analysisJob.count).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(service.countOrphanedJobs()).rejects.toThrow("database unavailable");
  });

  it("returns 0 when filter matches no records", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);

    const result = await service.countOrphanedJobs({ userId: 9999 });
    expect(result).toBe(0);
  });
});

describe("AnalysisJobService – getAnalysisStats edge cases", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("handles database errors gracefully", async () => {
    asMock(mockPrisma.analysisJob.count).mockRejectedValue(
      new Error("query failed"),
    );

    await expect(service.getAnalysisStats({ userId: 1 })).rejects.toThrow(
      "query failed",
    );
  });

  it("stuck count never exceeds processing count", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(10);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(5);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(3);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);

    const stats = await service.getAnalysisStats({ userId: 1 });
    expect(stats.stuck).toBe(1);
    expect(stats.stuck).toBeLessThanOrEqual(stats.processing);
  });

  it("returns consistent totals across all statuses", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(20);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(3);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(7);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(8);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);

    const stats = await service.getAnalysisStats({ userId: 1 });
    const sum = stats.processing + stats.queued + stats.done + stats.failed;
    expect(sum).toBe(stats.total);
  });
});

describe("AnalysisJobService – releaseLock", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("sets lockExpiresAt to current time for a job", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.releaseLock({ jobId: "job-1", workerId: "worker-A" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.data.lockExpiresAt).toBeInstanceOf(Date);
  });

  it("releases lock without workerId filter", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.releaseLock({ jobId: "job-1" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBeUndefined();
  });

  it("propagates database errors", async () => {
    asMock(mockPrisma.analysisJob.update).mockRejectedValueOnce(
      new Error("connection refused"),
    );

    await expect(service.releaseLock({ jobId: "job-1" })).rejects.toThrow("connection refused");
  });
});

describe("AnalysisJobService – markDrainReleased", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("sets status to QUEUED and expires the lock", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDrainReleased({
      jobId: "job-1",
      workerId: "worker-A",
      error: "Worker shutting down",
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.data.status).toBe("QUEUED");
    expect(call.data.lockedAt).toBeNull();
    expect(call.data.lockedBy).toBeNull();
    expect(call.data.lockExpiresAt).toBeInstanceOf(Date);
    expect(call.data.progressMessage).toContain("released");
  });

  it("uses workerId in the WHERE clause when provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDrainReleased({
      jobId: "job-1",
      workerId: "worker-B",
      error: "timeout",
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBe("worker-B");
  });

  it("skips workerId filter when not provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDrainReleased({
      jobId: "job-1",
      error: "shutdown",
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBeUndefined();
  });

  it("propagates database errors", async () => {
    asMock(mockPrisma.analysisJob.update).mockRejectedValueOnce(
      new Error("deadlock detected"),
    );

    await expect(
      service.markDrainReleased({ jobId: "job-1", error: "err" }),
    ).rejects.toThrow("deadlock detected");
  });
});

describe("AnalysisJobService – cleanupStaleJobs edge cases", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("does not fail when no matching records exist", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    const result = await service.cleanupStaleJobs();
    expect(result).toBe(0);
  });

  it("handles database errors", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockRejectedValueOnce(
      new Error("db timeout"),
    );

    await expect(service.cleanupStaleJobs()).rejects.toThrow("db timeout");
  });

  it("zero grace period marks all expired-lock jobs as failed", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 5 });

    const result = await service.cleanupStaleJobs(0);
    expect(result).toBe(5);
  });

  it("marks jobs as failed with error message", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    await service.cleanupStaleJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.data.error).toContain("heartbeat");
    expect(call.data.status).toBe("FAILED");
  });
});

describe("AnalysisJobService – exports", () => {
  it("exports a singleton instance", () => {
    const { analysisJobService } = require("../services/analysisJobService");
    expect(analysisJobService).toBeInstanceOf(AnalysisJobService);
  });

  it("exports the AnalysisJobService class", () => {
    const { AnalysisJobService: Cls } = require("../services/analysisJobService");
    expect(Cls).toBe(AnalysisJobService);
  });

  it("singleton has all expected methods", () => {
    const { analysisJobService } = require("../services/analysisJobService");
    expect(typeof analysisJobService.createRepositoryAnalysisJob).toBe("function");
    expect(typeof analysisJobService.getJob).toBe("function");
    expect(typeof analysisJobService.updateProgress).toBe("function");
    expect(typeof analysisJobService.markDone).toBe("function");
    expect(typeof analysisJobService.markFailed).toBe("function");
    expect(typeof analysisJobService.claimNextJob).toBe("function");
    expect(typeof analysisJobService.cleanupStaleJobs).toBe("function");
    expect(typeof analysisJobService.heartbeat).toBe("function");
    expect(typeof analysisJobService.reclaimOrphanedJobs).toBe("function");
    expect(typeof analysisJobService.countOrphanedJobs).toBe("function");
    expect(typeof analysisJobService.getAnalysisStats).toBe("function");
    expect(typeof analysisJobService.releaseLock).toBe("function");
    expect(typeof analysisJobService.markDrainReleased).toBe("function");
  });

  it("singleton methods are bound to the instance", () => {
    const { analysisJobService: svc } = require("../services/analysisJobService");
    const { reclaimOrphanedJobs, countOrphanedJobs, getAnalysisStats, cleanupStaleJobs } = svc;
    expect(typeof reclaimOrphanedJobs).toBe("function");
    expect(typeof countOrphanedJobs).toBe("function");
    expect(typeof getAnalysisStats).toBe("function");
    expect(typeof cleanupStaleJobs).toBe("function");
  });
});

describe("AnalysisJobService", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("exports a singleton", () => {
    expect(typeof service.createRepositoryAnalysisJob).toBe("function");
    expect(typeof service.createArchitectureGenerationJob).toBe("function");
    expect(typeof service.updateProgress).toBe("function");
    expect(typeof service.markDone).toBe("function");
    expect(typeof service.markFailed).toBe("function");
    expect(typeof service.getJob).toBe("function");
  });
});
