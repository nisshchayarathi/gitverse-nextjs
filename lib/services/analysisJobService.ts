import prisma from "../prisma";
import type { AnalysisJob } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type JobProgressUpdate = {
  progressPercent?: number;
  progressMessage?: string;
  progressDetails?: unknown;
};

const DEFAULT_LOCK_MS = 10 * 60 * 1000;

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
    scope?: string;
  }): Promise<AnalysisJob> {
    const existing = await prisma.analysisJob.findFirst({
      where: {
        repositoryId: params.repositoryId,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
    });
    if (existing) return existing;

    try {
      return await prisma.analysisJob.create({
        data: {
          repositoryId: params.repositoryId,
          userId: params.userId,
          type: "repository_analysis",
          status: "QUEUED",
          progressPercent: 0,
          progressMessage: "Queued",
          progressDetails: params.scope ? { scope: params.scope } : undefined,
          maxAttempts: params.maxAttempts ?? 3,
        },
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const activeJob = await prisma.analysisJob.findFirst({
          where: {
            repositoryId: params.repositoryId,
            status: { in: ["QUEUED", "PROCESSING"] },
          },
        });
        if (existingJob) return existingJob;

        // The active job may have completed between the P2002 and the lookup. Retry exactly once.
        return await prisma.analysisJob.create({
          data: {
            repositoryId: params.repositoryId,
            userId: params.userId,
            type: "repository_analysis",
            status: "QUEUED",
            progressPercent: 0,
            progressMessage: "Queued",
            progressDetails: params.scope ? { scope: params.scope } : undefined,
            maxAttempts: params.maxAttempts ?? 3,
          },
        });
      }
      throw error;
    }
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
        SELECT a1.id
        FROM analysis_jobs a1
        WHERE a1.next_run_at <= NOW()
          AND a1.status IN ('QUEUED', 'PROCESSING')
          AND (a1.lock_expires_at IS NULL OR a1.lock_expires_at < NOW())
          AND NOT EXISTS (
            SELECT 1 FROM analysis_jobs a2
            WHERE a2.repository_id = a1.repository_id
              AND a2.status = 'PROCESSING'
              AND a2.id != a1.id
              AND (a2.lock_expires_at IS NULL OR a2.lock_expires_at > NOW())
          )
        ORDER BY a1.created_at ASC
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
