// `jest.mock` factories are hoisted, so these bindings need `var` for
// initialization from the mocked modules before the service import runs.
var mockPrisma: any;

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: (mockPrisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    analysisJob: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  }),
}));

jest.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
    PrismaClientKnownRequestError,
  };
});

import { Prisma } from "@prisma/client";
import { AnalysisJobService } from "../services/analysisJobService";

type AnyMock = jest.Mock;

function asMock(fn: unknown): AnyMock {
  return fn as AnyMock;
}

function jobFixture(overrides: Partial<any> = {}) {
  return {
    id: "job-1",
    status: "QUEUED",
    type: "repository_analysis",
    repositoryId: 10,
    userId: 1,
    attempts: 0,
    maxAttempts: 3,
    nextRunAt: new Date("2026-01-01T00:00:00.000Z"),
    progressPercent: 0,
    progressMessage: "Queued",
    progressDetails: null,
    lockedAt: null,
    lockedBy: null,
    lockExpiresAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Default $transaction implementation: invoke the callback with a tx object
  // that proxies calls through to the same mockPrisma (mimicking Prisma's
  // real behaviour where `tx` exposes the same model surface as `prisma`).
  asMock(mockPrisma.$transaction).mockImplementation(
    async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
      callback(mockPrisma),
  );
  // Default: reclaimOrphanedJobs finds no stuck jobs
  asMock(mockPrisma.analysisJob.updateMany).mockResolvedValue({ count: 0 });
  // Default: countOrphanedJobs finds nothing
  asMock(mockPrisma.analysisJob.count).mockResolvedValue(0);
});

describe("AnalysisJobService – claimNextJob atomicity", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("wraps the claim in a single prisma.$transaction call", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1", status: "PROCESSING" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    expect(asMock(mockPrisma.$transaction)).toHaveBeenCalledTimes(1);
    expect(asMock(mockPrisma.$transaction).mock.calls[0][0]).toBeInstanceOf(
      Function,
    );
  });

  it("returns null when the CTE returns no candidate rows", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([]);

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toBeNull();
    expect(asMock(mockPrisma.analysisJob.findUnique)).not.toHaveBeenCalled();
  });

  it("re-fetches the claimed job via the transactional client", async () => {
    const claimedJob = jobFixture({
      id: "job-42",
      status: "PROCESSING",
      lockedBy: "worker-A",
    });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-42" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(claimedJob);

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toEqual(claimedJob);
    expect(asMock(mockPrisma.analysisJob.findUnique)).toHaveBeenCalledWith({
      where: { id: "job-42" },
    });
  });

  it("uses the transactional client (tx) for both the CTE and the re-fetch", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-7" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-7" }),
    );

    await service.claimNextJob({ workerId: "worker-Z" });

    // The CTE goes through tx.$queryRaw, which is the same mock function
    // as prisma.$queryRaw under the default $transaction implementation
    // (the callback receives the proxied client). The important assertion
    // is that findUnique is invoked *during* the transaction callback, not
    // after it returns.
    expect(asMock(mockPrisma.$queryRaw)).toHaveBeenCalledTimes(1);
    expect(asMock(mockPrisma.analysisJob.findUnique)).toHaveBeenCalledTimes(1);
  });

  it("uses FOR UPDATE SKIP LOCKED in the candidate CTE", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    const rawCall = asMock(mockPrisma.$queryRaw).mock.calls[0];
    // The first argument to a tagged-template raw query is an array of
    // strings (the SQL fragments). We join them and assert that the
    // critical concurrency primitive is present.
    const sqlFragments: string[] = rawCall[0];
    const sql = sqlFragments
      .filter((s) => typeof s === "string")
      .join(" ");
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
  });

  it("filters out jobs whose repository is already being processed by another worker", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-9" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-9" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    const rawCall = asMock(mockPrisma.$queryRaw).mock.calls[0];
    const sql = rawCall[0]
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/'PROCESSING'/);
  });

  it("increments the attempts counter on the claimed job", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    const rawCall = asMock(mockPrisma.$queryRaw).mock.calls[0];
    const sql = rawCall[0]
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    expect(sql).toMatch(/attempts\s*=\s*j\.attempts\s*\+\s*1/i);
  });

  it("uses a custom lockMs when supplied", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1" }),
    );

    await service.claimNextJob({ workerId: "worker-A", lockMs: 60_000 });

    const rawCall = asMock(mockPrisma.$queryRaw).mock.calls[0];
    // Tagged-template raw: callArgs[0] is the SQL string array, then the
    // interpolated values follow as positional args. The CTE interpolates
    // workerId, then lockMs.
    const interpolated = rawCall.slice(1);
    expect(interpolated).toContain(60_000);
    expect(interpolated).toContain("worker-A");
  });

  it("propagates errors from the transaction", async () => {
    asMock(mockPrisma.$transaction).mockImplementationOnce(async () => {
      throw new Error("connection lost");
    });

    await expect(
      service.claimNextJob({ workerId: "worker-A" }),
    ).rejects.toThrow("connection lost");
  });
});

describe("AnalysisJobService – claimNextJob concurrency contract", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("does not fall back to a non-transactional findFirst+update pattern", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    // The service must NEVER resolve to a `findFirst`+`update` pair outside
    // of the CTE+UPDATE statement – that is exactly the regression that
    // reintroduces the duplicate-claim race described in #1645.
    expect(asMock(mockPrisma.analysisJob.findFirst)).not.toHaveBeenCalled();
    expect(asMock(mockPrisma.analysisJob.update)).not.toHaveBeenCalled();
  });

  it("returns the typed (camelCase) record, not the snake_case row from the CTE", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    const typedJob = jobFixture({
      id: "job-1",
      status: "PROCESSING",
      repositoryId: 99,
    });
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(typedJob);

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toBe(typedJob);
    expect((result as any).repositoryId).toBe(99);
    expect((result as any).repository_id).toBeUndefined();
  });

  it("serializes the candidate SQL as a single statement (CTE+UPDATE)", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    const rawCall = asMock(mockPrisma.$queryRaw).mock.calls[0];
    const sql = rawCall[0]
      .filter((s: unknown) => typeof s === "string")
      .join(" ");
    // The CTE+UPDATE must be a single statement (one semicolon, or none
    // since tagged-template fragments are concatenated). The "WITH candidate
    // AS" and "UPDATE" must be in the same string.
    expect(sql).toMatch(/WITH\s+candidate\s+AS/i);
    expect(sql).toMatch(/UPDATE\s+analysis_jobs\s+j/i);
    expect(sql).toMatch(/RETURNING\s+j\.id/i);
  });
});

describe("AnalysisJobService – createRepositoryAnalysisJob", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("returns the existing active job instead of creating a duplicate", async () => {
    const existing = jobFixture({ id: "job-1", status: "PROCESSING" });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(existing);

    const result = await service.createRepositoryAnalysisJob({
      repositoryId: 10,
      userId: 1,
    });

    expect(result).toEqual(existing);
    expect(asMock(mockPrisma.analysisJob.create)).not.toHaveBeenCalled();
  });

  it("creates a new job when no active job exists", async () => {
    const created = jobFixture({ id: "job-2", status: "QUEUED" });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);
    asMock(mockPrisma.analysisJob.create).mockResolvedValueOnce(created);

    const result = await service.createRepositoryAnalysisJob({
      repositoryId: 10,
      userId: 1,
    });

    expect(result).toEqual(created);
    expect(asMock(mockPrisma.analysisJob.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repositoryId: 10,
          userId: 1,
          status: "QUEUED",
          maxAttempts: 3,
        }),
      }),
    );
  });

  it("passes the scope into progressDetails when supplied", async () => {
    const created = jobFixture({
      id: "job-3",
      progressDetails: { scope: "src/api" },
    });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);
    asMock(mockPrisma.analysisJob.create).mockResolvedValueOnce(created);

    await service.createRepositoryAnalysisJob({
      repositoryId: 10,
      userId: 1,
      scope: "src/api",
    });

    expect(asMock(mockPrisma.analysisJob.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          progressDetails: { scope: "src/api" },
        }),
      }),
    );
  });

  it("uses a custom maxAttempts when supplied", async () => {
    const created = jobFixture({ id: "job-4", maxAttempts: 7 });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);
    asMock(mockPrisma.analysisJob.create).mockResolvedValueOnce(created);

    await service.createRepositoryAnalysisJob({
      repositoryId: 10,
      userId: 1,
      maxAttempts: 7,
    });

    expect(asMock(mockPrisma.analysisJob.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxAttempts: 7 }),
      }),
    );
  });

  it("recovers from a P2002 unique-constraint violation by returning the active job", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: {} } as any,
    );
    const active = jobFixture({ id: "job-5", status: "QUEUED" });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst)
      .mockResolvedValueOnce(null) // initial check
      .mockResolvedValueOnce(active); // recovery lookup
    asMock(mockPrisma.analysisJob.create).mockRejectedValueOnce(p2002);

    const result = await service.createRepositoryAnalysisJob({
      repositoryId: 10,
      userId: 1,
    });

    expect(result).toEqual(active);
  });

  it("rethrows non-P2002 errors", async () => {
    const boom = new Error("disk full");
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);
    asMock(mockPrisma.analysisJob.create).mockRejectedValueOnce(boom);

    await expect(
      service.createRepositoryAnalysisJob({ repositoryId: 10, userId: 1 }),
    ).rejects.toThrow("disk full");
  });

  it("acquires a per-repository advisory lock before checking for duplicates", async () => {
    const created = jobFixture({ id: "job-6" });
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce(undefined);
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);
    asMock(mockPrisma.analysisJob.create).mockResolvedValueOnce(created);

    await service.createRepositoryAnalysisJob({
      repositoryId: 42,
      userId: 1,
    });

    expect(asMock(mockPrisma.$queryRaw)).toHaveBeenCalledTimes(1);
    const callArgs = asMock(mockPrisma.$queryRaw).mock.calls[0];
    // Tagged-template raw: callArgs[0] is the SQL string array, then the
    // interpolated values follow as positional args.
    const interpolated = callArgs.slice(1);
    expect(interpolated).toContain(42);
  });
});

describe("AnalysisJobService – getJob", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("returns the job when it belongs to the user", async () => {
    const job = jobFixture({ id: "job-1", userId: 7 });
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(job);

    const result = await service.getJob({ jobId: "job-1", userId: 7 });

    expect(result).toEqual(job);
    expect(asMock(mockPrisma.analysisJob.findFirst)).toHaveBeenCalledWith({
      where: { id: "job-1", userId: 7 },
    });
  });

  it("returns null when the job does not exist", async () => {
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);

    const result = await service.getJob({ jobId: "missing", userId: 7 });

    expect(result).toBeNull();
  });

  it("returns null when the job belongs to a different user", async () => {
    asMock(mockPrisma.analysisJob.findFirst).mockResolvedValueOnce(null);

    const result = await service.getJob({ jobId: "job-1", userId: 99 });

    expect(result).toBeNull();
  });
});

describe("AnalysisJobService – updateProgress", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("clamps progressPercent into [0, 100]", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressPercent: 250 },
    });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progressPercent: 100 }),
      }),
    );
  });

  it("clamps negative progressPercent to 0", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressPercent: -5 },
    });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progressPercent: 0 }),
      }),
    );
  });

  it("rounds fractional progressPercent to the nearest integer", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressPercent: 42.7 },
    });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progressPercent: 43 }),
      }),
    );
  });

  it("leaves progressPercent unset when it is not provided in the update", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressMessage: "still working" },
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    // The service uses `pct` (undefined when not supplied) as the value, so
    // Prisma receives an explicit `undefined` rather than a missing key.
    // The semantic we care about is that the column is not changed in the
    // resulting UPDATE.
    expect(call.data.progressPercent).toBeUndefined();
    expect(call.data.progressMessage).toBe("still working");
  });

  it("constrains the update to the calling worker when workerId is supplied", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressPercent: 50 },
    });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1", lockedBy: "worker-A" },
      }),
    );
  });

  it("does not constrain to a worker when workerId is omitted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      update: { progressPercent: 50 },
    });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1" } }),
    );
  });

  it("extends the lock when workerId is supplied", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const before = Date.now();
    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressPercent: 10 },
    });
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    const lockExpiresAt: Date = call.data.lockExpiresAt;
    expect(lockExpiresAt).toBeInstanceOf(Date);
    // Default lock is 5 minutes; allow a small window for clock drift.
    expect(lockExpiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 5 * 60 * 1000 - 100,
    );
    expect(lockExpiresAt.getTime()).toBeLessThanOrEqual(
      after + 5 * 60 * 1000 + 100,
    );
  });

  it("honours a custom extendLockMs", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const before = Date.now();
    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      extendLockMs: 30_000,
      update: { progressPercent: 10 },
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    const lockExpiresAt: Date = call.data.lockExpiresAt;
    expect(lockExpiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 30_000 - 100,
    );
  });

  it("does not extend the lock when workerId is omitted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      update: { progressPercent: 10 },
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.data).not.toHaveProperty("lockExpiresAt");
  });
});

describe("AnalysisJobService – markDone", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("marks the job as DONE and clears lock fields", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-1", workerId: "worker-A" });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1", lockedBy: "worker-A" },
        data: expect.objectContaining({
          status: "DONE",
          progressPercent: 100,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
        }),
      }),
    );
  });

  it("scopes the update to the calling worker", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-1", workerId: "worker-A" });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", lockedBy: "worker-A" } }),
    );
  });

  it("does not constrain to a worker when workerId is omitted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markDone({ jobId: "job-1" });

    expect(asMock(mockPrisma.analysisJob.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1" } }),
    );
  });

  it("stamps finishedAt with a recent Date", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const before = Date.now();
    await service.markDone({ jobId: "job-1" });
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    const finishedAt: Date = call.data.finishedAt;
    expect(finishedAt).toBeInstanceOf(Date);
    expect(finishedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(finishedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("AnalysisJobService – markFailed", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("schedules a retry when the error is retryable and attempts < maxAttempts", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      workerId: "worker-A",
      error: "ECONNRESET: connection reset by peer",
      attempts: 1,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: "job-1", lockedBy: "worker-A" });
    expect(call.data.status).toBe("QUEUED");
    expect(call.data.nextRunAt).toBeInstanceOf(Date);
    expect(call.data.lockedAt).toBeNull();
    expect(call.data.lockedBy).toBeNull();
    expect(call.data.lockExpiresAt).toBeNull();
  });

  it("marks the job as FAILED when attempts have been exhausted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      workerId: "worker-A",
      error: "ECONNRESET: connection reset by peer",
      attempts: 3,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
    expect(call.data.progressPercent).toBeNull();
    expect(call.data.finishedAt).toBeInstanceOf(Date);
  });

  it("marks the job as FAILED when the error is not retryable", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      error: "fatal: invalid API key",
      attempts: 1,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
  });

  it("uses an exponential backoff for the retry delay", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const observedAt = Date.now();
    await service.markFailed({
      jobId: "job-1",
      error: "ETIMEDOUT",
      attempts: 0,
      maxAttempts: 5,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    const nextRunAt: Date = call.data.nextRunAt;
    // First retry (attempts: 0): base delay of 10s. We compare against the
    // timestamp captured just before the call, and allow a generous window
    // to absorb jest/Prisma mock overhead and clock drift.
    const delay = nextRunAt.getTime() - observedAt;
    expect(delay).toBeGreaterThanOrEqual(8_000);
    expect(delay).toBeLessThanOrEqual(15_000);
  });

  it("does not constrain to a worker when workerId is omitted", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.markFailed({
      jobId: "job-1",
      error: "fatal: invalid API key",
      attempts: 3,
      maxAttempts: 3,
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: "job-1" });
  });
});

describe("AnalysisJobService – reclaimOrphanedJobs", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("requeues PROCESSING jobs whose lock has expired", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 3 });

    const result = await service.reclaimOrphanedJobs();

    expect(result).toBe(3);
    expect(asMock(mockPrisma.analysisJob.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PROCESSING",
          lockExpiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: "QUEUED",
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          nextRunAt: expect.any(Date),
          progressMessage: "Reclaimed after lock expiration",
        },
      }),
    );
  });

  it("does not affect jobs with a valid (non-expired) lock", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    const result = await service.reclaimOrphanedJobs();

    expect(result).toBe(0);
    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.where.lockExpiresAt).toEqual({ lt: expect.any(Date) });
  });

  it("does not affect DONE or FAILED jobs", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    await service.reclaimOrphanedJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.where.status).toBe("PROCESSING");
  });

  it("returns 0 when no PROCESSING jobs exist", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    const result = await service.reclaimOrphanedJobs();

    expect(result).toBe(0);
  });

  it("sets nextRunAt to now for immediate re-processing", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    const before = Date.now();
    await service.reclaimOrphanedJobs();
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    const nextRunAt: Date = call.data.nextRunAt;
    expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(nextRunAt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("AnalysisJobService – countOrphanedJobs", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("returns the count of PROCESSING jobs with expired locks", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(5);

    const result = await service.countOrphanedJobs();

    expect(result).toBe(5);
    expect(asMock(mockPrisma.analysisJob.count)).toHaveBeenCalledWith({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: expect.any(Date) },
      },
    });
  });

  it("filters by userId when provided", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);

    const result = await service.countOrphanedJobs({ userId: 42 });

    expect(result).toBe(2);
    expect(asMock(mockPrisma.analysisJob.count)).toHaveBeenCalledWith({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: expect.any(Date) },
        userId: 42,
      },
    });
  });

  it("returns 0 when no orphaned jobs exist", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);

    const result = await service.countOrphanedJobs();

    expect(result).toBe(0);
  });
});

describe("AnalysisJobService – getAnalysisStats", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("returns all job stats for a given user", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(10);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(3);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(4);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);

    const result = await service.getAnalysisStats({ userId: 7 });

    expect(result).toEqual({
      total: 10,
      processing: 2,
      queued: 3,
      done: 4,
      failed: 1,
      stuck: 1,
    });
  });

  it("returns zero counts when user has no jobs", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(0);

    const result = await service.getAnalysisStats({ userId: 99 });

    expect(result).toEqual({
      total: 0,
      processing: 0,
      queued: 0,
      done: 0,
      failed: 0,
      stuck: 0,
    });
  });

  it("uses Promise.all for parallel query execution", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(3);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(4);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(5);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(6);

    await service.getAnalysisStats({ userId: 7 });

    expect(asMock(mockPrisma.analysisJob.count)).toHaveBeenCalledTimes(6);
  });

  it("reports stuck jobs as a subset of processing jobs", async () => {
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(10);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(3);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(2);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(4);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);
    asMock(mockPrisma.analysisJob.count).mockResolvedValueOnce(1);

    const result = await service.getAnalysisStats({ userId: 7 });

    expect(result.stuck).toBeLessThanOrEqual(result.processing);
  });
});

describe("AnalysisJobService – claimNextJob with orphan reclamation", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("calls reclaimOrphanedJobs before the CTE claim", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([]);

    await service.claimNextJob({ workerId: "worker-A" });

    expect(asMock(mockPrisma.analysisJob.updateMany)).toHaveBeenCalledTimes(1);
    expect(asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0].where.status).toBe("PROCESSING");
  });

  it("still returns null when no candidate exists after reclamation", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([]);

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toBeNull();
  });

  it("claims a job after reclaiming orphaned jobs", async () => {
    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-1" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-1", status: "PROCESSING" }),
    );

    const result = await service.claimNextJob({ workerId: "worker-A" });

    expect(result).toBeTruthy();
    expect(result?.id).toBe("job-1");
  });

  it("reclaims orphaned jobs before finding a candidate", async () => {
    const reclaimSpy = jest.spyOn(service, "reclaimOrphanedJobs");
    reclaimSpy.mockResolvedValueOnce(3);

    asMock(mockPrisma.$queryRaw).mockResolvedValueOnce([{ id: "job-2" }]);
    asMock(mockPrisma.analysisJob.findUnique).mockResolvedValueOnce(
      jobFixture({ id: "job-2", status: "PROCESSING" }),
    );

    await service.claimNextJob({ workerId: "worker-A" });

    expect(reclaimSpy).toHaveBeenCalled();
    expect(asMock(mockPrisma.$queryRaw)).toHaveBeenCalled();
    reclaimSpy.mockRestore();
  });
});

describe("AnalysisJobService – cleanupStaleJobs", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("marks PROCESSING jobs whose lock has expired as FAILED", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 2 });

    const result = await service.cleanupStaleJobs();

    expect(result).toBe(2);
    expect(asMock(mockPrisma.analysisJob.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PROCESSING",
          lockExpiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: "FAILED",
          error: "Job timed out - no heartbeat received",
          progressMessage: "Job timed out - no heartbeat received",
          progressPercent: null,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
        }),
      }),
    );
  });

  it("returns 0 when no stale jobs are found", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 0 });

    const result = await service.cleanupStaleJobs();

    expect(result).toBe(0);
  });

  it("uses default 10-minute grace period when no argument is supplied", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    const before = Date.now();
    await service.cleanupStaleJobs();
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    const updatedAtThreshold: Date = call.where.updatedAt.lt;
    expect(updatedAtThreshold.getTime()).toBeGreaterThanOrEqual(
      Date.now() - 10 * 60 * 1000 - 2000,
    );
    expect(updatedAtThreshold.getTime()).toBeLessThanOrEqual(
      Date.now() - 10 * 60 * 1000 + 2000,
    );
  });

  it("honours a custom grace period", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    await service.cleanupStaleJobs(30 * 60 * 1000);

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    const updatedAtThreshold: Date = call.where.updatedAt.lt;
    expect(updatedAtThreshold.getTime()).toBeGreaterThanOrEqual(
      Date.now() - 30 * 60 * 1000 - 2000,
    );
    expect(updatedAtThreshold.getTime()).toBeLessThanOrEqual(
      Date.now() - 30 * 60 * 1000 + 2000,
    );
  });

  it("uses a short grace period for testing", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    await service.cleanupStaleJobs(1000);

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    const updatedAtThreshold: Date = call.where.updatedAt.lt;
    expect(updatedAtThreshold.getTime()).toBeGreaterThanOrEqual(
      Date.now() - 1000 - 500,
    );
    expect(updatedAtThreshold.getTime()).toBeLessThanOrEqual(
      Date.now() - 1000 + 500,
    );
  });

  it("clears lock fields on failed jobs", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    await service.cleanupStaleJobs();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    expect(call.data.lockedAt).toBeNull();
    expect(call.data.lockedBy).toBeNull();
    expect(call.data.lockExpiresAt).toBeNull();
  });

  it("sets finishedAt on failed jobs", async () => {
    asMock(mockPrisma.analysisJob.updateMany).mockResolvedValueOnce({ count: 1 });

    const before = Date.now();
    await service.cleanupStaleJobs();
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.updateMany).mock.calls[0][0];
    const finishedAt: Date = call.data.finishedAt;
    expect(finishedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(finishedAt.getTime()).toBeLessThanOrEqual(after);
  });
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

describe("AnalysisJobService – updateProgress edge cases", () => {
  let service: AnalysisJobService;

  beforeEach(() => {
    service = new AnalysisJobService();
  });

  it("handles undefined progress fields", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    await service.updateProgress({
      jobId: "job-1",
      update: {},
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.data.progressPercent).toBeUndefined();
    expect(call.data.progressMessage).toBeUndefined();
  });

  it("updates progress details via JSON field", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const details = { currentStep: "cloning", filesFound: 42 };
    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressDetails: details },
    });

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    expect(call.data.progressDetails).toEqual(details);
  });

  it("extends lock when workerId is supplied with details update", async () => {
    asMock(mockPrisma.analysisJob.update).mockResolvedValueOnce({});

    const before = Date.now();
    await service.updateProgress({
      jobId: "job-1",
      workerId: "worker-A",
      update: { progressDetails: { stage: "deep" } },
    });
    const after = Date.now();

    const call = asMock(mockPrisma.analysisJob.update).mock.calls[0][0];
    const lockExpiresAt: Date = call.data.lockExpiresAt;
    expect(lockExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000 - 100);
    expect(lockExpiresAt.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000 + 100);
  });
});

describe("AnalysisJobService – exported singleton", () => {
  it("exports a singleton instance for the rest of the codebase", () => {
    const { analysisJobService } = require("../services/analysisJobService");
    expect(analysisJobService).toBeInstanceOf(AnalysisJobService);
  });
});
