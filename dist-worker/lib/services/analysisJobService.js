"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisJobService = exports.AnalysisJobService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const DEFAULT_LOCK_MS = 10 * 60 * 1000;
function computeBackoffMs(attempt) {
    // Exponential backoff with cap (10s, 20s, 40s, ... up to 5m)
    const base = 10_000;
    const max = 5 * 60_000;
    return Math.min(max, base * Math.pow(2, Math.max(0, attempt - 1)));
}
class AnalysisJobService {
    async createRepositoryAnalysisJob(params) {
        const existing = await prisma_1.default.analysisJob.findFirst({
            where: {
                repositoryId: params.repositoryId,
                status: { in: ["QUEUED", "PROCESSING"] },
            },
        });
        if (existing)
            return existing;
        try {
            return await prisma_1.default.analysisJob.create({
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
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                const activeJob = await prisma_1.default.analysisJob.findFirst({
                    where: {
                        repositoryId: params.repositoryId,
                        status: { in: ["QUEUED", "PROCESSING"] },
                    },
                });
                if (activeJob)
                    return activeJob;
            }
            throw error;
        }
    }
    async getJob(params) {
        return prisma_1.default.analysisJob.findFirst({
            where: {
                id: params.jobId,
                userId: params.userId,
            },
        });
    }
    async updateProgress(params) {
        const lockExtension = params.extendLockMs ?? DEFAULT_LOCK_MS;
        await prisma_1.default.analysisJob.update({
            where: { id: params.jobId },
            data: {
                progressPercent: params.update.progressPercent,
                progressMessage: params.update.progressMessage,
                progressDetails: params.update.progressDetails,
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
    async markDone(params) {
        await prisma_1.default.analysisJob.update({
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
    async markFailed(params) {
        // Update repository status to failed when retries exhausted
        try {
            const job = await prisma_1.default.analysisJob.findUnique({
                where: { id: params.jobId },
                select: { repositoryId: true },
            });
            if (job?.repositoryId && params.attempts >= params.maxAttempts) {
                await prisma_1.default.repository.update({
                    where: { id: job.repositoryId },
                    data: { status: "failed" },
                });
            }
        }
        catch {
            // Non-critical: repo status update must not crash job status update
        }
        const shouldRetry = params.attempts < params.maxAttempts;
        if (shouldRetry) {
            const delay = computeBackoffMs(params.attempts);
            await prisma_1.default.analysisJob.update({
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
        await prisma_1.default.analysisJob.update({
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
    async claimNextJob(params) {
        const lockMs = params.lockMs ?? DEFAULT_LOCK_MS;
        // IMPORTANT:
        // Using `RETURNING j.*` returns snake_case DB column names (e.g. repository_id),
        // which does not match Prisma's camelCase field names (repositoryId) when read
        // in JS. That led to `job.repositoryId === undefined` and downstream failures.
        //
        // To keep atomic claiming behavior while returning correct field names, we:
        // 1) claim the job via raw SQL and return only the id
        // 2) re-fetch via Prisma Client (typed + camelCase fields)
        const rows = await prisma_1.default.$queryRaw `
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
        if (!claimedId)
            return null;
        return prisma_1.default.analysisJob.findUnique({ where: { id: claimedId } });
    }
    async cleanupStaleJobs() {
        const stale = await prisma_1.default.analysisJob.updateMany({
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
    async heartbeat(params) {
        const lockMs = params.lockMs ?? DEFAULT_LOCK_MS;
        await prisma_1.default.$executeRaw `
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
exports.AnalysisJobService = AnalysisJobService;
exports.analysisJobService = new AnalysisJobService();
