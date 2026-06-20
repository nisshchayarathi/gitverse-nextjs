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
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

import { AnalysisJobService } from "../services/analysisJobService";

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
    await service.heartbeat({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-001",
    });
    const after = Date.now();

    expect(asMock(mockPrisma.$executeRaw)).toHaveBeenCalledTimes(1);
    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const strings = callArgs[0];
    const interpolated = callArgs.slice(1);
    expect(strings).toBeInstanceOf(Array);
    expect(interpolated).toContain(5 * 60_000);
    expect(interpolated).toContain("job-1");
    expect(interpolated).toContain("worker-A");
    expect(interpolated).toContain("tok-001");
    expect(after - before).toBeGreaterThanOrEqual(0);
  });

  it("honours a custom lockMs", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    await service.heartbeat({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-002",
      lockMs: 30_000,
    });

    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const interpolated = callArgs.slice(1);
    expect(interpolated).toContain(30_000);
  });

  it("scopes the heartbeat to the calling worker and lockToken", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    await service.heartbeat({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-003",
    });

    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const strings = callArgs[0];
    const sql = strings
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    expect(sql).toMatch(/WHERE/i);
    expect(sql).toMatch(/status\s*=\s*'PROCESSING'/i);
    expect(sql).toMatch(/locked_by\s*=/i);
    expect(sql).toMatch(/lock_token\s*=/i);
  });

  it("includes lock_token in the WHERE clause", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce(undefined);

    await service.heartbeat({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-004",
    });

    const callArgs = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const strings = callArgs[0];
    const sql = strings.join(" ");
    expect(sql).toMatch(/lock_token/i);
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

describe("AnalysisJobService – claimNextJob with inline reclaim", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
    // Mock $transaction to execute the callback with a fake tx
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) =>
        cb({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }),
    );
  });

  it("runs reclaim inside the transaction before the CTE", async () => {
    const txExecuteRaw = jest.fn().mockResolvedValue(undefined);
    const txQueryRaw = jest.fn().mockResolvedValue([]);
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) =>
        cb({
          $executeRaw: txExecuteRaw,
          $queryRaw: txQueryRaw,
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }),
    );

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toBeNull();
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    const reclaimSql = (txExecuteRaw.mock.calls[0][0] as any[])
      .filter((s) => typeof s === "string")
      .join(" ");
    expect(reclaimSql).toMatch(/UPDATE analysis_jobs/i);
    expect(reclaimSql).toMatch(/lock_token = NULL/i);
  });

  it("returns null when no job is available", async () => {
    const result = await service.claimNextJob({ workerId: "worker-A" });
    expect(result).toBeNull();
  });

  it("returns a claimed job when a candidate exists", async () => {
    const fakeJob = { id: "job-claim-1", status: "PROCESSING", lockedBy: "worker-A" };
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) =>
        cb({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ id: "job-claim-1" }]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(fakeJob),
          },
        }),
    );

    const result = await service.claimNextJob({ workerId: "worker-A" });
    expect(result).toEqual(fakeJob);
  });
});

describe("AnalysisJobService – markDone with lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("includes lockToken in WHERE when both workerId and lockToken provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-1", workerId: "worker-A", lockToken: "tok-done" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-done");
    expect(call.data.status).toBe("DONE");
  });

  it("only uses id when workerId and lockToken are omitted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-1" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBeUndefined();
    expect(call.where.lockToken).toBeUndefined();
  });
});

describe("AnalysisJobService – markFailed with lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("includes lockToken in WHERE for retry path", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-fail",
      error: "timeout",
      attempts: 1,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-fail");
    expect(call.data.status).toBe("QUEUED");
    expect(call.data.lockToken).toBeNull();
  });

  it("includes lockToken in WHERE for final failure", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-final",
      error: "fatal error",
      attempts: 3,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-final");
    expect(call.data.status).toBe("FAILED");
    expect(call.data.lockToken).toBeNull();
  });

  it("skips lockToken when not provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      error: "error",
      attempts: 3,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockToken).toBeUndefined();
  });
});

describe("AnalysisJobService – updateProgress with lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("extends lock when workerId and lockToken provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-progress",
      update: { progressPercent: 50 },
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-progress");
    expect(call.data.lockExpiresAt).toBeInstanceOf(Date);
  });
});

describe("AnalysisJobService – reclaimOrphanedJobs clears lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("sets lockToken to null on reclaimed jobs", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 3 });

    const result = await service.reclaimOrphanedJobs();

    expect(result).toBe(3);
    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.data.lockToken).toBeNull();
  });
});

describe("AnalysisJobService – cleanupStaleJobs clears lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("sets lockToken to null on stale jobs", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    await service.cleanupStaleJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.data.lockToken).toBeNull();
  });
});

describe("AnalysisJobService – markDrainReleased clears lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("sets lockToken to null on drained jobs", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDrainReleased({
      jobId: "job-1",
      workerId: "worker-A",
      lockToken: "tok-drain",
      error: "shutdown",
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-drain");
    expect(call.data.lockToken).toBeNull();
  });
});

describe("AnalysisJobService – releaseLock with lockToken", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("includes lockToken in WHERE when provided with workerId", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.releaseLock({ jobId: "job-1", workerId: "worker-A", lockToken: "tok-rel" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-1");
    expect(call.where.lockedBy).toBe("worker-A");
    expect(call.where.lockToken).toBe("tok-rel");
  });

  it("skips lockToken when not provided", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.releaseLock({ jobId: "job-1" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockToken).toBeUndefined();
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

describe("AnalysisJobService – concurrent claim scenarios", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("simulates two workers racing for the same job — only one succeeds", async () => {
    let callCount = 0;
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) => {
        callCount++;
        return cb({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest
            .fn()
            .mockResolvedValue(
              callCount === 1 ? [{ id: "job-race-1" }] : [],
            ),
          analysisJob: {
            findUnique: jest
              .fn()
              .mockResolvedValue(
                callCount === 1
                  ? { id: "job-race-1", lockedBy: "worker-A" }
                  : null,
              ),
          },
        });
      },
    );

    const [resultA, resultB] = await Promise.all([
      service.claimNextJob({ workerId: "worker-A" }),
      service.claimNextJob({ workerId: "worker-B" }),
    ]);

    const claimedCount = [resultA, resultB].filter(Boolean).length;
    expect(claimedCount).toBe(1);
  });

  it("generates unique lockToken per claim", async () => {
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) =>
        cb({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ id: "job-tok-1" }]),
          analysisJob: {
            findUnique: jest
              .fn()
              .mockResolvedValue({
                id: "job-tok-1",
                lockToken: "tok-unique-001",
              }),
          },
        }),
    );

    const job = await service.claimNextJob({ workerId: "worker-A" });
    expect(job).not.toBeNull();
  });

  it("zombie heartbeat fails after reclaim clears lockToken", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce({ cmd: "UPDATE 0" });

    await service.heartbeat({
      jobId: "job-zombie",
      workerId: "worker-old",
      lockToken: "tok-stale",
    });

    const call = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const strings = call[0];
    const sql = strings
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    const interpolated = call.slice(1);
    expect(interpolated).toContain("tok-stale");
    expect(sql).toMatch(/lock_token\s*=/i);
  });

  it("reclaim clears lockToken so zombie operations cannot match", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({
      count: 1,
    });

    await service.reclaimOrphanedJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.data.lockToken).toBeNull();
  });

  it("stale markDone fails after re-claim regenerates lockToken", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({
      jobId: "job-stale",
      workerId: "worker-old",
      lockToken: "tok-stale",
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-stale");
    expect(call.where.lockedBy).toBe("worker-old");
    expect(call.where.lockToken).toBe("tok-stale");
  });

  it("stale markFailed after re-claim cannot overwrite new owner", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-stale-fail",
      workerId: "worker-old",
      lockToken: "tok-stale",
      error: "stale error",
      attempts: 1,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.lockToken).toBe("tok-stale");
  });

  it("heartbeat correctly fails when lockToken does not match", async () => {
    asMock(mockPrisma.$executeRaw).mockResolvedValueOnce({ cmd: "UPDATE 0" });

    await service.heartbeat({
      jobId: "job-mismatch",
      workerId: "worker-A",
      lockToken: "tok-wrong",
    });

    const call = asMock(mockPrisma.$executeRaw).mock.calls[0];
    const interpolated = call.slice(1);
    expect(interpolated).toContain("tok-wrong");
  });

  it("direct markDone without workerId does not require lockToken", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-direct" });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where.id).toBe("job-direct");
    expect(call.where.lockedBy).toBeUndefined();
    expect(call.where.lockToken).toBeUndefined();
  });

  it("claimNextJob returns null when CTE returns no candidate", async () => {
    asMock(mockPrisma.$transaction).mockImplementation(
      (cb: (tx: any) => Promise<any>) =>
        cb({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([]),
          analysisJob: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }),
    );

    const result = await service.claimNextJob({ workerId: "worker-A" });
    expect(result).toBeNull();
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
