import "dotenv/config";
import os from "os";
import prisma, { disconnectPrisma } from "../lib/prisma";
import { analysisJobService } from "../lib/services/analysisJobService";
import { repositoryService } from "../lib/services/repositoryService";

/**
 * Unique identifier for this worker instance. Used to claim and release
 * analysis job locks so other workers do not pick up the same job.
 */
const WORKER_ID =
  process.env.WORKER_ID ||
  `cron-${os.hostname()}-${process.pid}-${Date.now()}`;

/**
 * Maximum wall-clock time the worker will keep claiming new jobs.
 * Once this deadline passes, the current batch is the last.
 */
const TIMEOUT_MS = parseInt(process.env.CRON_WORKER_TIMEOUT_MS || "300000", 10);

/**
 * Maximum number of jobs to process in a single cycle.
 * Prevents the worker from monopolising the database connection pool.
 */
const BATCH_LIMIT = parseInt(process.env.CRON_WORKER_BATCH || "5", 10);

/**
 * TTL for completed WebhookEvent records.
 * Completed events older than this are permanently deleted to prevent unbounded table growth.
 * Retained in days; set via WEBHOOK_EVENT_RETENTION_DAYS env var (default: 30).
 */
const WEBHOOK_RETENTION_DAYS = parseInt(
  process.env.WEBHOOK_EVENT_RETENTION_DAYS || "30",
  10,
);

const cleanUpOldWebhookEvents = async (): Promise<number> => {
  if (WEBHOOK_RETENTION_DAYS <= 0) {
    // Disabled by setting WEBHOOK_EVENT_RETENTION_DAYS=0
    return 0;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WEBHOOK_RETENTION_DAYS);

  try {
    const result = await prisma.webhookEvent.deleteMany({
      where: {
        status: { in: ["completed", "failed", "rate_limited"] },
        createdAt: { lt: cutoff },
      },
    });
    return result.count;
  } catch (err) {
    console.error("[CronWorker] WebhookEvent cleanup error:", err);
    return 0;
  }
};

process.on("unhandledRejection", async (reason) => {
  console.error("[CronWorker] FATAL unhandled rejection:", reason);
  await releaseAllLocks();
  await disconnectPrisma();
  process.exit(1);
});

let shuttingDown = false;
const acquiredJobs: Map<string, { workerId: string; lockToken: string }> = new Map();

const releaseAllLocks = async () => {
  if (acquiredJobs.size === 0) return;
  console.log(`[CronWorker] Releasing ${acquiredJobs.size} lock(s) before exit`);
  const entries = Array.from(acquiredJobs.entries());
  for (const [jobId, lock] of entries) {
    try {
      await analysisJobService.releaseLock({
        jobId,
        workerId: lock.workerId,
        lockToken: lock.lockToken,
      });
    } catch (err) {
      console.error(`[CronWorker] Failed to release lock for job ${jobId}:`, err);
    }
  }
  acquiredJobs.clear();
};

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[CronWorker] Received ${signal}, shutting down gracefully`);
  await releaseAllLocks();
  await disconnectPrisma();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));

const checkDatabaseConnectivity = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("[CronWorker] Database connectivity check failed:", err);
    return false;
  }
};

const processJob = async (jobId: string): Promise<boolean> => {
  const lock = acquiredJobs.get(jobId);
  if (!lock) {
    console.error(`[CronWorker] No lock found for job ${jobId}`);
    return false;
  }

  try {
    const dbJob = await analysisJobService.getJob({ jobId, userId: 0 });
    if (!dbJob) {
      console.warn(`[CronWorker] Job ${jobId} not found in DB`);
      return false;
    }

    if (dbJob.type !== "repository_analysis" && dbJob.type !== "architecture_generation") {
      console.warn(`[CronWorker] Unsupported job type for ${jobId}: ${dbJob.type}`);
      await analysisJobService.markFailed({
        jobId,
        workerId: lock.workerId,
        lockToken: lock.lockToken,
        error: `Unsupported job type: ${dbJob.type}`,
        attempts: dbJob.attempts,
        maxAttempts: dbJob.maxAttempts,
      });
      return false;
    }

    console.log(`[CronWorker] Processing job ${jobId} (type: ${dbJob.type})`);

    if (dbJob.type === "repository_analysis") {
      const details = dbJob.progressDetails as any;
      await repositoryService.analyzeRepository(dbJob.repositoryId, dbJob.userId, {
        scope: details?.scope,
      });
    }

    await analysisJobService.markDone({
      jobId,
      workerId: lock.workerId,
      lockToken: lock.lockToken,
    });
    console.log(`[CronWorker] Job ${jobId} completed successfully`);
    return true;
  } catch (err: any) {
    const message = err?.message ? String(err.message) : String(err);
    console.error(`[CronWorker] Job ${jobId} failed:`, message);

    try {
      const dbJob = await analysisJobService.getJob({ jobId, userId: 0 });
      await analysisJobService.markFailed({
        jobId,
        workerId: lock.workerId,
        lockToken: lock.lockToken,
        error: message,
        attempts: dbJob?.attempts ?? 0,
        maxAttempts: dbJob?.maxAttempts ?? 3,
      });
    } catch (markErr) {
      console.error(`[CronWorker] Failed to mark job ${jobId} as failed:`, markErr);
    }
    return false;
  }
};

const runOnce = async (): Promise<number> => {
  const healthy = await checkDatabaseConnectivity();
  if (!healthy) {
    throw new Error("Database connectivity check failed — aborting cron worker run");
  }

  const reclaimed = await analysisJobService.reclaimOrphanedJobs();
  if (reclaimed > 0) {
    console.log(`[CronWorker] Reclaimed ${reclaimed} orphaned job(s)`);
  }

  const cleanedWebhookEvents = await cleanUpOldWebhookEvents();
  if (cleanedWebhookEvents > 0) {
    console.log(`[CronWorker] Cleaned up ${cleanedWebhookEvents} old WebhookEvent record(s)`);
  }

  const deadline = Date.now() + TIMEOUT_MS;
  let processed = 0;

  for (let i = 0; i < BATCH_LIMIT; i++) {
    if (Date.now() >= deadline) {
      console.log(`[CronWorker] Timeout approaching, stopping after ${processed} job(s)`);
      break;
    }

    const job = await analysisJobService.claimNextJob({ workerId: WORKER_ID });
    if (!job) {
      console.log(`[CronWorker] No more jobs to claim`);
      break;
    }

    acquiredJobs.set(job.id, { workerId: WORKER_ID, lockToken: job.lockToken! });
    try {
      await processJob(job.id);
      processed++;
    } finally {
      acquiredJobs.delete(job.id);
    }
  }

  console.log(`[CronWorker] Processed ${processed} job(s) this cycle`);
  return processed;
};

const main = async () => {
  try {
    const processed = await runOnce();
    await releaseAllLocks();
    await disconnectPrisma();
    process.exit(processed > 0 ? 0 : 0);
  } catch (err) {
    console.error("[CronWorker] Fatal error:", err);
    await releaseAllLocks();
    await disconnectPrisma();
    process.exit(1);
  }
};

main();
