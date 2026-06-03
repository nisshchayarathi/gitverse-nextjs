import prisma from "../prisma";
import type { AnalysisJob } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { isRetryableError, computeBackoffMs } from "../utils/retry";

export type JobProgressUpdate = {
  progressPercent?: number;
  progressMessage?: string;
  progressDetails?: unknown;
};

const DEFAULT_LOCK_MS = 5 * 60 * 1000;

export class AnalysisJobService {
  async reclaimOrphanedJobs(): Promise<number> {
    const result = await prisma.analysisJob.updateMany({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: new Date() },
      },
      data: {
        status: "QUEUED",
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
        nextRunAt: new Date(),
        progressMessage: "Reclaimed after lock expiration",
      },
    });
    return result.count;
  }

  async countOrphanedJobs(params?: { userId?: number }): Promise<number> {
    const where: any = {
      status: "PROCESSING",
      lockExpiresAt: { lt: new Date() },
    };
    if (params?.userId) where.userId = params.userId;
    return prisma.analysisJob.count({ where });
  }

  async getAnalysisStats(params: { userId: number }): Promise<{
    total: number;
    processing: number;
    queued: number;
    done: number;
    failed: number;
    stuck: number;
  }> {
    const [total, processing, queued, done, failed, stuck] =
      await Promise.all([
        prisma.analysisJob.count({ where: { userId: params.userId } }),
        prisma.analysisJob.count({
          where: { userId: params.userId, status: "PROCESSING" },
        }),
        prisma.analysisJob.count({
          where: { userId: params.userId, status: "QUEUED" },
        }),
        prisma.analysisJob.count({
          where: { userId: params.userId, status: "DONE" },
        }),
        prisma.analysisJob.count({
          where: { userId: params.userId, status: "FAILED" },
        }),
        prisma.analysisJob.count({
          where: {
            userId: params.userId,
            status: "PROCESSING",
            lockExpiresAt: { lt: new Date() },
          },
        }),
      ]);
    return { total, processing, queued, done, failed, stuck };
  }

  async createRepositoryAnalysisJob(params: {
    repositoryId: number;
    userId: number;
    maxAttempts?: number;
    scope?: string;
  }): Promise<AnalysisJob> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${params.repositoryId})`;

      const existing = await tx.analysisJob.findFirst({
        where: {
          repositoryId: params.repositoryId,
          status: { in: ["QUEUED", "PROCESSING"] },
        },
      });
      if (existing) return existing;

      try {
        return await tx.analysisJob.create({
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
          const activeJob = await tx.analysisJob.findFirst({
            where: {
              repositoryId: params.repositoryId,
              status: { in: ["QUEUED", "PROCESSING"] },
            },
          });
          if (activeJob) return activeJob;
        }
        throw error;
      }
    });
  }

  async getJob(params: {
    jobId: string;
    userId: number;
  }): Promise<AnalysisJob | null> {
    const job = await prisma.analysisJob.findUnique({
      where: {
        id: params.jobId,
      },
      include: {
        repository: {
          select: { userId: true },
        },
      },
    });

    if (!job) return null;

    let hasAccess = false;

    // 1. User is the creator of the job
    if (job.userId === params.userId) {
      hasAccess = true;
    } 
    // 2. User is the owner of the repository
    else if (job.repository.userId === params.userId) {
      hasAccess = true;
    } 
    // 3. User has access via organization membership
    else {
      const orgAccess = await prisma.repositoryPolicyAssignment.findFirst({
        where: {
          repositoryId: job.repositoryId,
          organization: {
            members: {
              some: { userId: params.userId },
            },
          },
        },
      });

      if (orgAccess) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return null;
    }

    // Strip the joined repository to match the expected return type
    const { repository, ...jobData } = job as any;
    return jobData as AnalysisJob;
  }

  async updateProgress(params: {
    jobId: string;
    workerId?: string;
    update: JobProgressUpdate;
    extendLockMs?: number;
  }): Promise<void> {
    const lockExtension = params.extendLockMs ?? DEFAULT_LOCK_MS;

    const pct = params.update.progressPercent !== undefined
      ? Math.max(0, Math.min(100, Math.round(params.update.progressPercent)))
      : undefined;

    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }

    await prisma.analysisJob.update({
      where,
      data: {
        progressPercent: pct,
        progressMessage: params.update.progressMessage,
        progressDetails: params.update.progressDetails as any,
        ...(params.workerId
          ? {
              lockExpiresAt: new Date(Date.now() + lockExtension),
            }
          : {}),
      },
    });
  }

  async markDone(params: { jobId: string; workerId?: string }): Promise<void> {
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }

    await prisma.analysisJob.update({
      where,
      data: {
        status: "DONE",
        progressPercent: 100,
        progressMessage: "Analysis complete! ✓",
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
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }

    const shouldRetry =
      params.attempts < params.maxAttempts &&
      isRetryableError(params.error);
    if (shouldRetry) {
      const delay = computeBackoffMs(params.attempts);
      await prisma.analysisJob.update({
        where,
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
      where,
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        progressMessage: "Analysis failed. Please try again.",
        progressPercent: null,
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

    await this.reclaimOrphanedJobs();

    // The claim must be atomic: a worker can only observe a job as available
    // while no other transaction holds the matching row lock. The CTE below
    // uses `FOR UPDATE SKIP LOCKED` so concurrent workers each pick a
    // distinct row instead of contending on the same one, and the whole
    // claim + re-fetch runs inside a $transaction so the row lock acquired
    // by the CTE is held until we have read the freshly updated record.
    //
    // `RETURNING j.*` returns snake_case column names (e.g. repository_id)
    // which would arrive in JS as the wrong shape, so we return only the id
    // here and re-fetch via Prisma for typed, camelCase fields.
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
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
          progress_message = COALESCE(j.progress_message, 'Analysis in progress...'),
          progress_percent = COALESCE(j.progress_percent, 0)
        FROM candidate
        WHERE j.id = candidate.id
        RETURNING j.id
      `;

      const claimedId = rows[0]?.id;
      if (!claimedId) return null;

      return tx.analysisJob.findUnique({ where: { id: claimedId } });
    });
  }

  async cleanupStaleJobs(gracePeriodMs: number = 10 * 60 * 1000): Promise<number> {
    const stale = await prisma.analysisJob.updateMany({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: new Date() },
        updatedAt: { lt: new Date(Date.now() - gracePeriodMs) },
      },
      data: {
        status: "FAILED",
        error: "Job timed out - no heartbeat received",
        progressMessage: "Job timed out - no heartbeat received",
        progressPercent: null,
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
