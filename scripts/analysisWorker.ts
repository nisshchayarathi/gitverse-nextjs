import "dotenv/config";
import os from "os";
import { Worker, Job } from "bullmq";
import connection from "../lib/redis";
import prisma, { disconnectPrisma } from "../lib/prisma";
import { analysisJobService } from "../lib/services/analysisJobService";
import { repositoryService } from "../lib/services/repositoryService";
import { ANALYSIS_QUEUE_NAME } from "../lib/queue/analysisQueue";

// Catch any rejections that slip through the promise-gap fixes above.
process.on("unhandledRejection", async (reason) => {
  console.error("FATAL unhandled rejection — worker will exit:", reason);
  await disconnectPrisma();
  process.exit(1);
});

<<<<<<< fix/worker-graceful-shutdown-job-drain
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LOCK_MS = 5 * 60_000;
const GRACE_PERIOD_MS = 30_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

=======
>>>>>>> main
function getWorkerId(): string {
  return (
    process.env.WORKER_ID ||
    `${os.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`
  );
}

<<<<<<< fix/worker-graceful-shutdown-job-drain
let currentJob: AnalysisJob | null = null;
let jobRunning = false;
let stopping = false;
let forcedExitTimer: NodeJS.Timeout | null = null;

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
    if (stopping) return;
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
    currentJob = job;
    jobRunning = true;

    await writeProgress({ progressPercent: 0, progressMessage: "Processing" });

    heartbeatTimer = setInterval(() => {
      if (stopping) {
        clearInterval(heartbeatTimer!);
        heartbeatTimer = null;
        return;
      }
      analysisJobService
        .heartbeat({
          jobId: job.id,
          workerId: params.workerId,
          lockMs: params.lockMs,
        })
        .catch((e) => console.error("heartbeat failed", e));
    }, params.heartbeatIntervalMs);

    if (stopping) return;

    if (job.type !== "repository_analysis") {
      throw new Error(`Unsupported job type: ${job.type}`);
    }

    const details = job.progressDetails as any;
    const scope = details?.scope;

    if (stopping) return;

    await repositoryService.analyzeRepository(job.repositoryId, job.userId, {
      scope,
      onProgress: async (update) => {
        if (stopping) return;
        await writeProgress(update);
      },
    });

    if (stopping) return;

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
    jobRunning = false;
    currentJob = null;
  }
}

export async function startAnalysisWorkerLoop(opts?: {
  workerId?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  lockMs?: number;
  once?: boolean;
  gracePeriodMs?: number;
  signalHandlers?: boolean;
}) {
  const workerId = opts?.workerId || getWorkerId();
  const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const heartbeatIntervalMs =
    opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const lockMs = opts?.lockMs ?? LOCK_MS;
  const gracePeriodMs = opts?.gracePeriodMs ?? GRACE_PERIOD_MS;

  const registerHandlers = opts?.signalHandlers ?? true;

  console.log(`analysis worker starting: ${workerId}`);
=======
export async function startAnalysisWorkerLoop(opts?: {
  workerId?: string;
}) {
  const workerId = opts?.workerId || getWorkerId();
  console.log(`BullMQ analysis worker starting: ${workerId}`);

  const worker = new Worker(
    ANALYSIS_QUEUE_NAME,
    async (job: Job) => {
      const { jobId, userId } = job.data;
      console.log(`Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

      const dbJob = await analysisJobService.getJob({ jobId, userId });
      if (!dbJob) {
        throw new Error(`Job ${jobId} not found in DB for user ${userId}`);
      }
>>>>>>> main

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

        // Debounce updates to DB if nothing changed
        if (!percentChanged && !messageChanged && now - lastProgressWriteAt < 1000) {
          return;
        }

        await analysisJobService.updateProgress({
          jobId,
          update,
        });

        // Also update BullMQ progress
        if (update.progressPercent != null) {
          await job.updateProgress(update.progressPercent);
        }

        lastProgressWriteAt = now;
        if (update.progressPercent != null)
          lastProgressPercent = update.progressPercent;
        if (update.progressMessage != null)
          lastProgressMessage = update.progressMessage;
      };

      try {
        await writeProgress({ progressPercent: 0, progressMessage: "Processing" });

        if (dbJob.type !== "repository_analysis" && dbJob.type !== "architecture_generation") {
          throw new Error(`Unsupported job type: ${dbJob.type}`);
        }

        const details = dbJob.progressDetails as any;
        const scope = details?.scope;

        if (dbJob.type === "repository_analysis") {
          await repositoryService.analyzeRepository(dbJob.repositoryId, dbJob.userId, {
            scope,
            onProgress: async (update) => {
              await writeProgress(update);
            },
          });
        } else {
          // Handle architecture_generation if needed, for now just marking complete
          // as per existing codebase pattern
          await writeProgress({ progressPercent: 100, progressMessage: "Architecture analysis complete" });
        }

        await analysisJobService.markDone({ jobId });
      } catch (err: any) {
        const message = err?.message ? String(err.message) : String(err);
        console.error(`Job ${jobId} failed:`, err);

        await analysisJobService.markFailed({
          jobId,
          error: message,
          attempts: job.attemptsMade + 1,
          maxAttempts: dbJob.maxAttempts,
        });
        
        throw err; // Re-throw to let BullMQ handle retry/failure logic
      }
    },
    {
      connection: connection as any,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "1", 10),
      name: workerId,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on("failed", (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
<<<<<<< fix/worker-graceful-shutdown-job-drain
    console.log(`received ${signal}, shutting down...`);

    if (forcedExitTimer) clearTimeout(forcedExitTimer);
    forcedExitTimer = setTimeout(() => {
      console.error(`grace period expired (${gracePeriodMs}ms), forcing exit`);
      process.exit(1);
    }, gracePeriodMs);

    if (jobRunning && currentJob) {
      const jobId = currentJob.id;
      console.log(`draining job ${jobId} before exit...`);
      try {
        await analysisJobService.markDrainReleased({
          jobId,
          workerId,
          error: "Worker shutting down",
        });
        console.log(`job ${jobId} released for reprocessing`);
      } catch (drainErr) {
        console.error(`failed to release job ${jobId} during drain:`, drainErr);
        try {
          await analysisJobService.releaseLock({ jobId, workerId });
        } catch (lockErr) {
          console.error(`failed to release lock for job ${jobId}:`, lockErr);
        }
      }
    }

    if (forcedExitTimer) clearTimeout(forcedExitTimer);
    forcedExitTimer = null;

=======
    console.log(`Received ${signal}, shutting down BullMQ worker...`);
    await worker.close();
    await connection.quit();
>>>>>>> main
    await disconnectPrisma();
    process.exit(0);
  };

<<<<<<< fix/worker-graceful-shutdown-job-drain
  if (registerHandlers) {
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
    process.on("SIGHUP", () => void shutdown("SIGHUP"));
  }

  while (!stopping) {
    try {
      await analysisJobService.reclaimOrphanedJobs();
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
=======
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
  process.on("SIGHUP", () => void shutdown("SIGHUP"));
>>>>>>> main
}

const isMain = typeof require !== "undefined" && (require as any).main === module;
if (isMain) {
<<<<<<< fix/worker-graceful-shutdown-job-drain
  const once = !!process.env.WORKER_ONCE;
  const gracePeriodMs = process.env.WORKER_GRACE_PERIOD_MS
    ? Number(process.env.WORKER_GRACE_PERIOD_MS)
    : undefined;
  startAnalysisWorkerLoop({ once, gracePeriodMs, signalHandlers: true }).catch(async (e) => {
    console.error("worker fatal:", e);
=======
  startAnalysisWorkerLoop().catch(async (e) => {
    console.error("Worker fatal error:", e);
>>>>>>> main
    await disconnectPrisma();
    process.exit(1);
  });
}
