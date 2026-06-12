import prisma from "../prisma";
import type { AnalysisJob } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { isRetryableError, computeBackoffMs } from "../utils/retry";
import { analysisQueue } from "../queue/analysisQueue";

export type JobProgressUpdate = {
  progressPercent?: number;
  progressMessage?: string;
  progressDetails?: unknown;
};

/**
 * Default lock duration in milliseconds (5 minutes). When a worker claims
 * a job, the lock expires after this interval unless extended via heartbeat.
 * The cron worker runs every 5 minutes with a 4-minute timeout, so locks
 * expire before the next worker cycle begins, preventing double-processing
 * when a worker crashes without releasing its locks.
 */
const DEFAULT_LOCK_MS = 5 * 60 * 1000;

/**
 * AnalysisJobService manages the lifecycle of background analysis jobs.
 *
 * Responsibilities:
 * - Job creation (repository analysis, architecture generation)
 * - Job claiming with atomic locking (FOR UPDATE SKIP LOCKED)
 * - Lock heartbeat and extension
 * - Orphaned job reclamation (expired lock recovery)
 * - Progress tracking and status transitions
 *
 * Concurrency model:
 * - claimNextJob() uses a CTE with FOR UPDATE SKIP LOCKED inside a
 *   Prisma $transaction, guaranteeing that concurrent workers each
 *   pick distinct rows without blocking each other.
 * - reclaimOrphanedJobs() is called at the start of every claim cycle
 *   so expired locks are released before new jobs are acquired.
 * - The calling worker (cronWorker.ts) also calls reclaimOrphanedJobs()
 *   before entering its claim loop, providing a second recovery pass.
 */
export class AnalysisJobService {

  /**
   * Returns per-user aggregate counts across all job statuses.
   * Runs six parallel COUNT queries. If any fails, the entire call
   * rejects. Used by the dashboard and status API endpoints.
   */
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

  /**
   * Creates a QUEUED repository analysis job and enqueues it via BullMQ.
   * If a QUEUED or PROCESSING job already exists for this repository,
   * returns the existing job instead of creating a duplicate.
   * The entire check-and-create operation runs inside a $transaction
   * to prevent race conditions where two callers see no active job
   * and both create one.
   */
  async createRepositoryAnalysisJob(params: {
    repositoryId: number;
    userId: number;
    maxAttempts?: number;
    scope?: string;
  }): Promise<AnalysisJob> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.analysisJob.findFirst({
        where: {
          repositoryId: params.repositoryId,
          status: { in: ["QUEUED", "PROCESSING"] },
        },
      });
      if (existing) return existing;

      try {
        const job = await tx.analysisJob.create({
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
        await analysisQueue.add("repository_analysis", { jobId: job.id, userId: params.userId });
        return job;
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

  /**
   * Creates a QUEUED architecture generation job with PostgreSQL advisory
   * locking to serialize concurrent creation requests for the same repository.
   * pg_advisory_xact_lock ensures the check-and-create is serialized at the
   * database level, not just the application level.
   */
  async createArchitectureGenerationJob(params: {
    repositoryId: number;
    userId: number;
    maxAttempts?: number;
  }): Promise<AnalysisJob> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${params.repositoryId})`;

      const existing = await tx.analysisJob.findFirst({
        where: {
          repositoryId: params.repositoryId,
          type: "architecture_generation",
          status: { in: ["QUEUED", "PROCESSING"] },
        },
      });
      if (existing) return existing;

      try {
        const job = await tx.analysisJob.create({
          data: {
            repositoryId: params.repositoryId,
            userId: params.userId,
            type: "architecture_generation",
            status: "QUEUED",
            progressPercent: 0,
            progressMessage: "Queued",
            maxAttempts: params.maxAttempts ?? 3,
          },
        });
        await analysisQueue.add("architecture_generation", { jobId: job.id, userId: params.userId });
        return job;
      } catch (error: any) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const activeJob = await tx.analysisJob.findFirst({
            where: {
              repositoryId: params.repositoryId,
              type: "architecture_generation",
              status: { in: ["QUEUED", "PROCESSING"] },
            },
          });
          if (activeJob) return activeJob;
        }
        throw error;
      }
    });
  }

  /**
   * Retrieves a single job by ID, enforcing access control:
   * 1. The user who created the job
   * 2. The owner of the repository the job analyses
   * 3. A member of an organization with access to the repository
   * Returns null if the job does not exist or the user lacks access.
   * Cron workers pass userId=0 to bypass the access check (internal caller).
   */
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

    if (job.userId === params.userId) {
      hasAccess = true;
    } else if (job.repository.userId === params.userId) {
      hasAccess = true;
    } else {
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

    const { repository, ...jobData } = job as any;
    return jobData as AnalysisJob;
  }

  /**
   * Updates a job's progress percentage and message.
   * If workerId is provided, also extends the lock by extendLockMs.
   * This is called periodically by the repository analysis logic to
   * report progress and prevent lock expiry during long analyses.
   */
  async updateProgress(params: {
    jobId: string;
    workerId?: string;
    lockToken?: string;
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
    if (params.lockToken) {
      where.lockToken = params.lockToken;
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

  /**
   * Marks a job as DONE with 100% progress and clears all lock fields.
   * Requires workerId in the WHERE clause so only the owning worker can
   * complete a job. This prevents a race where two workers both think
   * they own the same job.
   */
  async markDone(params: { jobId: string; workerId?: string; lockToken?: string }): Promise<void> {
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }
    if (params.lockToken) {
      where.lockToken = params.lockToken;
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
        lockToken: null,
      },
    });
  }

  /**
   * Marks a job as FAILED or re-queues it for a retry.
   * If the error is retryable and attempts < maxAttempts, the job is
   * set back to QUEUED with an exponential backoff delay via computeBackoffMs.
   * Non-retryable errors or exhausted attempts result in a permanent FAILED state.
   * Lock fields are cleared in both cases so other workers can pick up
   * retried jobs.
   */
  async markFailed(params: {
    jobId: string;
    workerId?: string;
    lockToken?: string;
    error: string;
    attempts: number;
    maxAttempts: number;
  }): Promise<void> {
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }
    if (params.lockToken) {
      where.lockToken = params.lockToken;
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
          lockToken: null,
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
        lockToken: null,
      },
    });
  }

  /**
   * Atomically claims the next available job for a worker.
   *
   * The claim uses a Common Table Expression (CTE) with FOR UPDATE SKIP LOCKED
   * inside a Prisma $transaction. This guarantees:
   * - Each job is claimed by at most one worker
   * - Workers do not block each other (SKIP LOCKED)
   * - A repository cannot have two concurrent analyses (NOT EXISTS subquery)
   *
   * The sequence:
   * 1. Reclaim orphaned jobs (expired locks → QUEUED)
   * 2. CTE selects the oldest candidate job (by created_at) that has no
   *    concurrently running analysis for the same repository
   * 3. UPDATE locks the row and sets status to PROCESSING
   * 4. RETURNING the claimed id
   * 5. Re-fetch via Prisma findUnique for typed camelCase fields
   *
   * RETURNING j.* is intentionally avoided because Prisma's raw query
   * adapter returns snake_case column names that do not match the
   * AnalysisJob type.
   */
  async claimNextJob(params: {
    workerId: string;
    lockMs?: number;
  }): Promise<AnalysisJob | null> {
    const lockMs = params.lockMs ?? DEFAULT_LOCK_MS;

    await this.reclaimOrphanedJobs();

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE analysis_jobs
        SET
          status = 'QUEUED',
          locked_by = NULL,
          locked_at = NULL,
          lock_expires_at = NULL,
          lock_token = NULL,
          updated_at = NOW()
        WHERE status = 'PROCESSING'
          AND lock_expires_at < NOW()
      `;

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
          lock_token = gen_random_uuid(),
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

  /**
   * Immediately expires a job's lock by setting lockExpiresAt to now.
   * This makes the job available for reclamation on the next cycle.
   * Called during graceful worker shutdown so queued jobs are not
   * blocked for the full DEFAULT_LOCK_MS duration.
   */
  async releaseLock(params: {
    jobId: string;
    workerId?: string;
    lockToken?: string;
  }): Promise<void> {
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }
    if (params.lockToken) {
      where.lockToken = params.lockToken;
    }
    await prisma.analysisJob.update({
      where,
      data: {
        lockExpiresAt: new Date(),
      },
    });
  }

  /**
   * Finds all jobs in PROCESSING status with expired locks (lockExpiresAt
   * is in the past) and resets them to QUEUED with null lock fields.
   * This is the crash recovery mechanism: when a worker dies without
   * releasing its locks, they expire and this function makes them available
   * for the next worker cycle.
   *
   * Called by:
   * - cronWorker.ts runOnce() before entering the claim loop
   * - claimNextJob() as a precondition of every claim attempt
   *
   * The operation is idempotent — calling it multiple times has no
   * additional effect since PROCESSING jobs with unexpired locks are
   * not matched by the WHERE clause.
   */
  async reclaimOrphanedJobs(): Promise<number> {
    const result = await prisma.analysisJob.updateMany({
      where: {
        status: "PROCESSING",
        lockExpiresAt: { lt: new Date() },
      },
      data: {
        status: "QUEUED",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockToken: null,
      },
    });
    return result.count;
  }

  /**
   * Counts orphaned jobs (PROCESSING with expired locks) for a user
   * or globally. Used by the dashboard to show stuck job warnings.
   * Does not modify any rows — use reclaimOrphanedJobs for that.
   */
  async countOrphanedJobs(params?: { userId?: number }): Promise<number> {
    const where: any = {
      status: "PROCESSING",
      lockExpiresAt: { lt: new Date() },
    };
    if (params?.userId != null) {
      where.userId = params.userId;
    }
    return prisma.analysisJob.count({ where });
  }

  /**
   * Releases a job back to QUEUED when a worker is draining (shutting down).
   * Unlike releaseLock which only expires the lock, this also resets the
   * lock fields and sets nextRunAt to now so the job is immediately
   * available for the next worker. Used when the cron worker exits to
   * ensure jobs are not stuck waiting for the next cron cycle.
   */
  async markDrainReleased(params: {
    jobId: string;
    workerId?: string;
    lockToken?: string;
    error: string;
  }): Promise<void> {
    const where: any = { id: params.jobId };
    if (params.workerId) {
      where.lockedBy = params.workerId;
    }
    if (params.lockToken) {
      where.lockToken = params.lockToken;
    }
    await prisma.analysisJob.update({
      where,
      data: {
        status: "QUEUED",
        lockExpiresAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lockToken: null,
        nextRunAt: new Date(),
        progressMessage: "Worker shutting down — job released for reprocessing",
        error: params.error,
      },
    });
  }

  /**
   * Marks jobs as FAILED if they have been in PROCESSING status without
   * updates for longer than the grace period. This is a harder recovery
   * mechanism than reclaimOrphanedJobs: it permanently fails jobs instead
   * of requeueing them, preventing infinite retries of jobs whose workers
   * have permanently disappeared.
   *
   * The grace period defaults to 10 minutes. Jobs with null lockExpiresAt
   * are also matched (edge case where a bug created a PROCESSING job
   * without setting a lock expiry).
   */
  async cleanupStaleJobs(gracePeriodMs: number = 10 * 60 * 1000): Promise<number> {
    const stale = await prisma.analysisJob.updateMany({
      where: {
        status: "PROCESSING",
        OR: [
          { lockExpiresAt: { lt: new Date() } },
          { lockExpiresAt: null },
        ],
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
        lockToken: null,
      },
    });
    return stale.count;
  }

  /**
   * Extends a job's lock expiry by lockMs milliseconds.
   * The raw SQL UPDATE includes both status='PROCESSING' and
   * locked_by=workerId in the WHERE clause so a worker cannot
   * accidentally heartbeat a job it does not own. If the job was
   * already completed or reassigned, the UPDATE matches zero rows
   * and the heartbeat is silently dropped (the calling worker will
   * discover the issue on its next operation).
   */
  async heartbeat(params: {
    jobId: string;
    workerId: string;
    lockToken: string;
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
        AND lock_token = ${params.lockToken}::uuid
    `;
  }
}

export const analysisJobService = new AnalysisJobService();
