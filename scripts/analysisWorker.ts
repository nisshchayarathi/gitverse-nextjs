import "dotenv/config";
import os from "os";
import prisma from "../lib/prisma";
import { analysisJobService } from "../lib/services/analysisJobService";
import { repositoryService } from "../lib/services/repositoryService";
import type { AnalysisJob } from "@prisma/client";

// Catch any rejections that slip through the promise-gap fixes above.
// Without this, Node 15+ crashes the entire worker on an unhandled rejection.
process.on("unhandledRejection", (reason) => {
  console.error("FATAL unhandled rejection — worker will exit:", reason);
  // Log and exit so the orchestrator can retry the job.
  process.exit(1);
});

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LOCK_MS = 5 * 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWorkerId(): string {
  return (
    process.env.WORKER_ID ||
    `${os.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`
  );
}

async function runJob(
  job: AnalysisJob,
  params: {
    workerId: string;
    lockMs: number;
    heartbeatIntervalMs: number;
  }
) {
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastProgressWriteAt = 0;
  let lastProgressPercent: number | undefined;
  let lastProgressMessage: string | undefined;

  const writeProgress = async (update: {
    progressPercent?: number;
    progressMessage?: string;
    progressDetails?: unknown;
  }) => {
    const now = Date.now();

    const percentChanged =
      update.progressPercent != null &&
      update.progressPercent !== lastProgressPercent;
    const messageChanged =
      update.progressMessage != null &&
      update.progressMessage !== lastProgressMessage;

    if (
      !percentChanged &&
      !messageChanged &&
      now - lastProgressWriteAt < 1000
    ) {
      return;
    }

    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId: params.workerId,
      extendLockMs: params.lockMs,
      update,
    });

    lastProgressWriteAt = now;
    if (update.progressPercent != null)
      lastProgressPercent = update.progressPercent;
    if (update.progressMessage != null)
      lastProgressMessage = update.progressMessage;
  };

  try {
    await writeProgress({ progressPercent: 0, progressMessage: "Processing" });

    heartbeatTimer = setInterval(() => {
      analysisJobService
        .heartbeat({
          jobId: job.id,
          workerId: params.workerId,
          lockMs: params.lockMs,
        })
        .catch((e) => console.error("heartbeat failed", e));
    }, params.heartbeatIntervalMs);

    if (job.type !== "repository_analysis") {
      throw new Error(`Unsupported job type: ${job.type}`);
    }

    await repositoryService.analyzeRepository(job.repositoryId, {
      onProgress: async (update) => {
        await writeProgress(update);
      },
    });

    await analysisJobService.markDone({
      jobId: job.id,
      workerId: params.workerId,
    });
  } catch (err: any) {
    const message = err?.message ? String(err.message) : String(err);
    console.error(`Job ${job.id} failed:`, err);

    await analysisJobService.markFailed({
      jobId: job.id,
      workerId: params.workerId,
      error: message,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

export async function startAnalysisWorkerLoop(opts?: {
  workerId?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  lockMs?: number;
  once?: boolean;
}) {
  const workerId = opts?.workerId || getWorkerId();
  const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const heartbeatIntervalMs =
    opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const lockMs = opts?.lockMs ?? LOCK_MS;

  console.log(`analysis worker starting: ${workerId}`);

  let stopping = false;

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`received ${signal}, shutting down...`);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  while (!stopping) {
    try {
      const job = await analysisJobService.claimNextJob({
        workerId,
        lockMs,
      });

      if (!job) {
        if (opts?.once) return;
        await sleep(pollIntervalMs);
        continue;
      }

      console.log(
        `claimed job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`
      );
      await runJob(job, { workerId, lockMs, heartbeatIntervalMs });

      if (opts?.once) return;
    } catch (e) {
      console.error("worker loop error:", e);
      if (opts?.once) return;
      await sleep(pollIntervalMs);
    }
  }
}

// Run as standalone script
// (tsc -> CJS) so `require.main === module` works after compilation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMain =
  typeof require !== "undefined" && (require as any).main === module;
if (isMain) {
  const once = !!process.env.WORKER_ONCE;
  startAnalysisWorkerLoop({ once }).catch((e) => {
    console.error("worker fatal:", e);
    process.exit(1);
  });
}
