import "dotenv/config";
import os from "os";
import prisma from "../lib/prisma";
import { analysisJobService } from "../lib/services/analysisJobService";
import { repositoryService } from "../lib/services/repositoryService";
import {
  isRateLimitError,
  extractRetryAfter,
  sanitizeErrorMessage,
} from "../lib/utils/rateLimit";
import type { AnalysisJob } from "@prisma/client";

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
): Promise<boolean> {
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
        .catch((e) => console.error("heartbeat failed", sanitizeErrorMessage(e)));
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
    return true;
  } catch (err: any) {
    const rateLimited = isRateLimitError(err);
    const retryAfter = rateLimited ? extractRetryAfter(err) : null;
    const safeMessage = sanitizeErrorMessage(err);

    if (rateLimited) {
      console.error(
        `Job ${job.id} rate limited (attempt ${job.attempts}/${job.maxAttempts})` +
          (retryAfter ? `, retry after ${retryAfter}s` : "")
      );
    } else {
      console.error(`Job ${job.id} failed: ${safeMessage}`);
    }

    await analysisJobService.markFailed({
      jobId: job.id,
      workerId: params.workerId,
      error: safeMessage,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      retryAfter: retryAfter ?? undefined,
    });

    const shouldRetry = job.attempts < job.maxAttempts;
    if (!shouldRetry && job.type === "repository_analysis") {
      await repositoryService.markRepositoryFailed(job.repositoryId, safeMessage);
    }

    return false;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

export interface AnalysisWorkerSummary {
  totalJobsScanned: number;
  jobsProcessed: number;
  jobsSkipped: number;
  jobsFailed: number;
  executionDurationMs: number;
  success: boolean;
  budgetExhausted?: boolean;
  earlyStopReason?: string;
}

export async function startAnalysisWorkerLoop(opts?: {
  workerId?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  lockMs?: number;
  once?: boolean;
  timeBudgetMs?: number;
}) {
  const workerId = opts?.workerId || getWorkerId();
  const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const heartbeatIntervalMs =
    opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const lockMs = opts?.lockMs ?? LOCK_MS;

  console.log(`analysis worker starting: ${workerId}`);

  let stopping = false;
  const startTimeMs = Date.now();
  let totalJobsScanned = 0;
  let jobsProcessed = 0;
  let jobsSkipped = 0;
  let jobsFailed = 0;
  
  const timeBudgetMs = opts?.timeBudgetMs;
  const budgetGraceMs = opts?.budgetGraceMs ?? 10_000; // 10s default buffer
  let budgetExhausted = false;
  let earlyStopReason: string | undefined;

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

  const startTime = Date.now();
  let jobsProcessed = 0;
  let jobsSkipped = 0;

  while (!stopping) {
    if (timeBudgetMs) {
      const elapsed = Date.now() - startTimeMs;
      const remaining = timeBudgetMs - elapsed;
      if (remaining <= budgetGraceMs) {
        console.log(`Time budget nearly exhausted (${remaining}ms remaining). Stopping gracefully.`);
        budgetExhausted = true;
        earlyStopReason = "time_budget_exhausted";
        break;
      }
    }

    try {
      if (opts?.timeBudgetMs) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= opts.timeBudgetMs) {
          console.log(`Time budget of ${opts.timeBudgetMs}ms reached (elapsed: ${elapsed}ms). Processed ${jobsProcessed} jobs. Shutting down gracefully...`);
          break;
        }
      }

      const job = await analysisJobService.claimNextJob({
        workerId,
        lockMs,
      });

      if (!job) {
        jobsSkipped++;
        if (opts?.once) {
          console.log(`No jobs available. Processed ${jobsProcessed} jobs.`);
          return;
        }
        await sleep(pollIntervalMs);
        continue;
      }

      totalJobsScanned++;
      console.log(
        `claimed job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`
      );
      await runJob(job, { workerId, lockMs, heartbeatIntervalMs });
      jobsProcessed++;

      if (opts?.once) {
        console.log(`Finished one-shot run. Processed ${jobsProcessed} jobs.`);
        return;
      }
    } catch (e) {
      console.error("worker loop error:", sanitizeErrorMessage(e));
      if (opts?.once) {
        return {
          totalJobsScanned,
          jobsProcessed,
          jobsSkipped,
          jobsFailed,
          executionDurationMs: Date.now() - startTimeMs,
          success: false,
          budgetExhausted,
          earlyStopReason,
        };
      }
      await sleep(pollIntervalMs);
    }
  }

  return {
    totalJobsScanned,
    jobsProcessed,
    jobsSkipped,
    jobsFailed,
    executionDurationMs: Date.now() - startTimeMs,
    success: true,
    budgetExhausted,
    earlyStopReason,
  };
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
