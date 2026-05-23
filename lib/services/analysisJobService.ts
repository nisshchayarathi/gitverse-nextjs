import prisma from "../prisma";
import type { AnalysisJob } from "@prisma/client";

export type JobProgressUpdate = {
  progressPercent?: number;
  progressMessage?: string;
  progressDetails?: unknown;
};

const DEFAULT_LOCK_MS = 5 * 60 * 1000;

function computeBackoffMs(attempt: number): number {
  // Exponential backoff with cap (10s, 20s, 40s, ... up to 5m)
  const base = 10_000;
  const max = 5 * 60_000;
  return Math.min(max, base * Math.pow(2, Math.max(0, attempt - 1)));
}

export class AnalysisJobService {
  async createRepositoryAnalysisJob(params: {
    repositoryId: number;
    userId: number;
    maxAttempts?: number;
  }): Promise<AnalysisJob> {
    return prisma.analysisJob.create({
      data: {
        repositoryId: params.repositoryId,
        userId: params.userId,
        type: "repository_analysis",
        status: "QUEUED",
        progressPercent: 0,
        progressMessage: "Queued",
        maxAttempts: params.maxAttempts ?? 3,
      },
    });
  }

  async getJob(params: {
    jobId: string;
    userId: number;
  }): Promise<AnalysisJob | null> {
    return prisma.analysisJob.findFirst({
      where: {
        id: params.jobId,
        userId: params.userId,
      },
    });
  }

  async updateProgress(params: {
    jobId: string;
    workerId?: string;
    update: JobProgressUpdate;
    extendLockMs?: number;
  }): Promise<void> {
    const lockExtension = params.extendLockMs ?? DEFAULT_LOCK_MS;

    await prisma.analysisJob.update({
      where: { id: params.jobId },
      data: {
        progressPercent: params.update.progressPercent,
        progressMessage: params.update.progressMessage,
        progressDetails: params.update.progressDetails as any,
        // Heartbeat: extend lock while we’re actively working
        ...(params.workerId
          ? {
              lockedBy: params.workerId,
              lockExpiresAt: new Date(Date.now() + lockExtension),
            }
          : {}),
      },
    });
  }

  async markDone(params: { jobId: string; workerId?: string }): Promise<void> {
    await prisma.analysisJob.update({
      where: { id: params.jobId },
      data: {
        status: "DONE",
        progressPercent: 100,
        progressMessage: "Done",
        finishedAt: new Date(),
        error: null,
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
  }

  async markFailed(params: {
    jobId: string;
    workerId?: string;
    error: string;
    attempts: number;
    maxAttempts: number;
  }): Promise<void> {
    // Update repository status to failed when retries exhausted
    try {
      const job = await prisma.analysisJob.findUnique({
        where: { id: params.jobId },
        select: { repositoryId: true },
      });
      if (job?.repositoryId && params.attempts >= params.maxAttempts) {
        await prisma.repository.update({
          where: { id: job.repositoryId },
          data: { status: "failed" },
        });
      }
    } catch {
      // Non-critical: repo status update must not crash job status update
    }
    const shouldRetry = params.attempts < params.maxAttempts;

    if (shouldRetry) {
      const delay = computeBackoffMs(params.attempts);
      await prisma.analysisJob.update({
        where: { id: params.jobId },
        data: {
          status: "QUEUED",
          nextRunAt: new Date(Date.now() + delay),
          progressMessage: `Retrying in ${Math.round(delay / 1000)}s`,
          error: params.error,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
        },
      });
      return;
    }

    await prisma.analysisJob.update({
      where: { id: params.jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        progressMessage: "Failed",
        error: params.error,
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
  }

  async claimNextJob(params: {
    workerId: string;
    lockMs?: number;
  }): Promise<AnalysisJob | null> {
    const lockMs = params.lockMs ?? DEFAULT_LOCK_MS;

    // IMPORTANT:
    // Using `RETURNING j.*` returns snake_case DB column names (e.g. repository_id),
    // which does not match Prisma's camelCase field names (repositoryId) when read
    // in JS. That led to `job.repositoryId === undefined` and downstream failures.
    //
    // To keep atomic claiming behavior while returning correct field names, we:
    // 1) claim the job via raw SQL and return only the id
    // 2) re-fetch via Prisma Client (typed + camelCase fields)
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      WITH candidate AS (
        SELECT id
        FROM analysis_jobs
        WHERE next_run_at <= NOW()
          AND status IN ('QUEUED', 'PROCESSING')
          AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE analysis_jobs j
      SET
        status = 'PROCESSING',
        locked_at = NOW(),
        locked_by = ${params.workerId},
        lock_expires_at = NOW() + (${lockMs}::int * INTERVAL '1 millisecond'),
        attempts = j.attempts + 1,
        started_at = COALESCE(j.started_at, NOW()),
        updated_at = NOW(),
        progress_message = COALESCE(j.progress_message, 'Processing'),
        progress_percent = COALESCE(j.progress_percent, 0)
      FROM candidate
      WHERE j.id = candidate.id
      RETURNING j.id
    `;

    const claimedId = rows[0]?.id;
    if (!claimedId) return null;

    return prisma.analysisJob.findUnique({ where: { id: claimedId } });
  }

  async cleanupStaleJobs(): Promise<number> {
    const stale = await prisma.analysisJob.updateMany({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: new Date() },
        updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
      data: {
        status: "FAILED",
        error: "Job timed out - no heartbeat received",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    });
    return stale.count;
  }

  async heartbeat(params: {
    jobId: string;
    workerId: string;
    lockMs?: number;
  }): Promise<void> {
    const lockMs = params.lockMs ?? DEFAULT_LOCK_MS;
    await prisma.$executeRaw`
      UPDATE analysis_jobs
      SET
        lock_expires_at = NOW() + (${lockMs}::int * INTERVAL '1 millisecond'),
        locked_by = ${params.workerId},
        updated_at = NOW()
      WHERE id = ${params.jobId}::uuid
        AND status = 'PROCESSING'
        AND locked_by = ${params.workerId}
    `;
  }
}

export const analysisJobService = new AnalysisJobService();
