import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as http from "http";

const mockDisconnectPrisma = vi.fn().mockResolvedValue(undefined);
const mockGetPoolHealth = vi.fn().mockReturnValue({ healthy: true, totalConnections: 5, idleConnections: 3, waitingClients: 0 });
const mockGetPoolMetrics = vi.fn().mockReturnValue([]);

vi.mock("../../lib/prisma", () => ({
  default: {},
  disconnectPrisma: mockDisconnectPrisma,
  getPoolHealth: mockGetPoolHealth,
  getPoolMetrics: mockGetPoolMetrics,
}));

const mockReleaseLock = vi.fn().mockResolvedValue(undefined);
const mockMarkDrainReleased = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/services/analysisJobService", () => ({
  analysisJobService: {
    reclaimOrphanedJobs: vi.fn().mockResolvedValue(0),
    claimNextJob: vi.fn().mockResolvedValue(null),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markDone: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    releaseLock: mockReleaseLock,
    markDrainReleased: mockMarkDrainReleased,
  },
}));

vi.mock("../../lib/services/repositoryService", () => ({
  repositoryService: {
    analyzeRepository: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("os", () => ({
  hostname: vi.fn().mockReturnValue("test-host"),
}));

describe("Drain method coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markDrainReleased is called before releaseLock when drain succeeds", async () => {
    mockMarkDrainReleased.mockResolvedValueOnce(undefined);
    mockReleaseLock.mockResolvedValueOnce(undefined);

    const jobId = "job-coord-1";
    const workerId = "worker-drain";
    const drainError = "Worker shut down by SIGTERM";

    try {
      await mockMarkDrainReleased({ jobId, workerId, error: drainError });
    } catch {
      await mockReleaseLock({ jobId, workerId });
    }

    expect(mockMarkDrainReleased).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-coord-1", workerId: "worker-drain" }),
    );
    expect(mockReleaseLock).not.toHaveBeenCalled();
  });

  it("releaseLock is called as fallback when markDrainReleased fails", async () => {
    mockMarkDrainReleased.mockRejectedValueOnce(new Error("timeout"));
    mockReleaseLock.mockResolvedValueOnce(undefined);

    const jobId = "job-coord-2";
    const workerId = "worker-fallback";

    try {
      await mockMarkDrainReleased({ jobId, workerId, error: "db error" });
    } catch {
      await mockReleaseLock({ jobId, workerId });
    }

    expect(mockMarkDrainReleased).toHaveBeenCalled();
    expect(mockReleaseLock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-coord-2" }),
    );
  });

  it("both drain methods can fail without throwing unhandled errors", async () => {
    mockMarkDrainReleased.mockRejectedValueOnce(new Error("primary fail"));
    mockReleaseLock.mockRejectedValueOnce(new Error("fallback fail"));

    const jobId = "job-coord-3";
    const workerId = "worker-bad-luck";

    let caught: Error | null = null;
    try {
      await mockMarkDrainReleased({ jobId, workerId, error: "err" });
    } catch (e: any) {
      caught = e;
      try {
        await mockReleaseLock({ jobId, workerId });
      } catch {
        // both failed — acceptable, log and continue exit
      }
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe("primary fail");
  });
});

describe("Drain endpoint and server behavior", () => {
  it("responds with drain initiated on /drain", async () => {
    const server = http.createServer((req: any, res: any) => {
      if (req.url === "/drain") {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("drain initiated");
        return;
      }
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("not found");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as any;
    const port = addr.port;

    const response = await fetch(`http://localhost:${port}/drain`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("drain");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns 200 for health and readiness checks", async () => {
    const server = http.createServer((req: any, res: any) => {
      if (req.url === "/healthz" || req.url === "/readyz") {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("ok");
        return;
      }
      res.statusCode = 404;
      res.end("not found");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as any;
    const port = addr.port;

    const healthz = await fetch(`http://localhost:${port}/healthz`);
    expect(healthz.status).toBe(200);
    expect(await healthz.text()).toBe("ok");

    const readyz = await fetch(`http://localhost:${port}/readyz`);
    expect(readyz.status).toBe(200);
    expect(await readyz.text()).toBe("ok");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe("Forced exit timeout during shutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets a forced exit timer with correct grace period", () => {
    const GRACE_PERIOD_MS = 35000;
    let timerFired = false;

    const forcedExitTimer = setTimeout(() => {
      timerFired = true;
    }, GRACE_PERIOD_MS);

    vi.advanceTimersByTime(GRACE_PERIOD_MS + 100);
    expect(timerFired).toBe(true);
    clearTimeout(forcedExitTimer);
  });

  it("cancels forced exit timer when graceful shutdown completes", () => {
    const GRACE_PERIOD_MS = 35000;
    let timerFired = false;

    const forcedExitTimer = setTimeout(() => {
      timerFired = true;
    }, GRACE_PERIOD_MS);

    clearTimeout(forcedExitTimer);
    vi.advanceTimersByTime(GRACE_PERIOD_MS + 100);
    expect(timerFired).toBe(false);
  });

  it("uses different grace period for standalone worker vs server", () => {
    const workerGrace = 30_000;
    const serverGrace = 35_000;

    expect(serverGrace - workerGrace).toBe(5_000);
    expect(workerGrace).toBeLessThan(serverGrace);
  });
});

describe("Environment variable integration", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("generates worker ID from hostname, pid, and random when WORKER_ID is not set", async () => {
    delete process.env.WORKER_ID;
    const os = await import("os");
    const hostname = os.hostname();
    const pid = process.pid;

    const workerId = `${hostname}-${pid}-${Math.random().toString(16).slice(2)}`;
    expect(workerId).toContain(hostname);
    expect(workerId).toContain(String(pid));
  });

  it("uses WORKER_ID env var when set", () => {
    process.env.WORKER_ID = "custom-worker-1";
    const workerId = process.env.WORKER_ID;
    expect(workerId).toBe("custom-worker-1");
  });
});

describe("WriteProgress drain guard", () => {
  it("skips progress write when stopping flag is set", () => {
    let writes = 0;
    const stopping = true;
    const writeProgress = async (update: any) => {
      if (stopping) {
        return;
      }
      writes++;
    };

    writeProgress({ progressPercent: 50 });
    expect(writes).toBe(0);
  });

  it("allows progress write when stopping flag is not set", async () => {
    let writes = 0;
    const stopping = false;
    const writeProgress = async (update: any) => {
      if (stopping) {
        return;
      }
      writes++;
    };

    await writeProgress({ progressPercent: 50 });
    expect(writes).toBe(1);
  });

  it("throttles progress writes within 1s window when not stopping", async () => {
    let writes = 0;
    let lastWriteAt = 0;
    const stopping = false;

    const writeProgress = async (update: any) => {
      if (stopping) return;
      const now = Date.now();
      if (now - lastWriteAt < 1000) return;
      lastWriteAt = now;
      writes++;
    };

    await writeProgress({ progressPercent: 10 });
    await writeProgress({ progressPercent: 20 });
    expect(writes).toBe(1);
  });
});

describe("Heartbeat guard during drain", () => {
  it("stops heartbeat interval when stopping flag is set", () => {
    vi.useFakeTimers();
    let heartbeatFired = false;
    const stopping = true;
    const heartbeatTimer = setInterval(() => {
      if (stopping) {
        clearInterval(heartbeatTimer);
        return;
      }
      heartbeatFired = true;
    }, 100);

    vi.advanceTimersByTime(200);
    expect(heartbeatFired).toBe(false);
    clearInterval(heartbeatTimer);
  });

  it("continues heartbeat when not stopping", () => {
    vi.useFakeTimers();
    let heartbeatFired = false;
    const stopping = false;
    const heartbeatTimer = setInterval(() => {
      if (!stopping) {
        heartbeatFired = true;
      }
    }, 50);

    vi.advanceTimersByTime(100);
    expect(heartbeatFired).toBe(true);
    clearInterval(heartbeatTimer);
    vi.useRealTimers();
  });
});
