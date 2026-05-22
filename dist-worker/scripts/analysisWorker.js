"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAnalysisWorkerLoop = startAnalysisWorkerLoop;
require("dotenv/config");
const os_1 = __importDefault(require("os"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const analysisJobService_1 = require("../lib/services/analysisJobService");
const repositoryService_1 = require("../lib/services/repositoryService");
const rateLimit_1 = require("../lib/utils/rateLimit");
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LOCK_MS = 5 * 60_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getWorkerId() {
    return (process.env.WORKER_ID ||
        `${os_1.default.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`);
}
async function runJob(job, params) {
    let heartbeatTimer = null;
    let lastProgressWriteAt = 0;
    let lastProgressPercent;
    let lastProgressMessage;
    const writeProgress = async (update) => {
        const now = Date.now();
        const percentChanged = update.progressPercent != null &&
            update.progressPercent !== lastProgressPercent;
        const messageChanged = update.progressMessage != null &&
            update.progressMessage !== lastProgressMessage;
        if (!percentChanged &&
            !messageChanged &&
            now - lastProgressWriteAt < 1000) {
            return;
        }
        await analysisJobService_1.analysisJobService.updateProgress({
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
            analysisJobService_1.analysisJobService
                .heartbeat({
                jobId: job.id,
                workerId: params.workerId,
                lockMs: params.lockMs,
            })
                .catch((e) => console.error("heartbeat failed", (0, rateLimit_1.sanitizeErrorMessage)(e)));
        }, params.heartbeatIntervalMs);
        if (job.type !== "repository_analysis") {
            throw new Error(`Unsupported job type: ${job.type}`);
        }
        await repositoryService_1.repositoryService.analyzeRepository(job.repositoryId, {
            onProgress: async (update) => {
                await writeProgress(update);
            },
        });
        await analysisJobService_1.analysisJobService.markDone({
            jobId: job.id,
            workerId: params.workerId,
        });
        return true;
    }
    catch (err) {
        const rateLimited = (0, rateLimit_1.isRateLimitError)(err);
        const retryAfter = rateLimited ? (0, rateLimit_1.extractRetryAfter)(err) : null;
        const safeMessage = (0, rateLimit_1.sanitizeErrorMessage)(err);
        if (rateLimited) {
            console.error(`Job ${job.id} rate limited (attempt ${job.attempts}/${job.maxAttempts})` +
                (retryAfter ? `, retry after ${retryAfter}s` : ""));
        }
        else {
            console.error(`Job ${job.id} failed: ${safeMessage}`);
        }
        await analysisJobService_1.analysisJobService.markFailed({
            jobId: job.id,
            workerId: params.workerId,
            error: safeMessage,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            retryAfter: retryAfter ?? undefined,
        });
        return false;
    }
    finally {
        if (heartbeatTimer)
            clearInterval(heartbeatTimer);
    }
}
async function startAnalysisWorkerLoop(opts) {
    const workerId = opts?.workerId || getWorkerId();
    const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
    const heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    const lockMs = opts?.lockMs ?? LOCK_MS;
    console.log(`analysis worker starting: ${workerId}`);
    let stopping = false;
    const startTimeMs = Date.now();
    let totalJobsScanned = 0;
    let jobsProcessed = 0;
    let jobsSkipped = 0;
    let jobsFailed = 0;
    const shutdown = async (signal) => {
        if (stopping)
            return;
        stopping = true;
        console.log(`received ${signal}, shutting down...`);
        try {
            await prisma_1.default.$disconnect();
        }
        catch {
            // ignore
        }
        process.exit(0);
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
    while (!stopping) {
        try {
            const job = await analysisJobService_1.analysisJobService.claimNextJob({
                workerId,
                lockMs,
            });
            if (!job) {
                jobsSkipped++;
                if (opts?.once)
                    break;
                await sleep(pollIntervalMs);
                continue;
            }
            totalJobsScanned++;
            console.log(`claimed job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
            const isSuccess = await runJob(job, { workerId, lockMs, heartbeatIntervalMs });
            if (isSuccess) {
                jobsProcessed++;
            }
            else {
                jobsFailed++;
            }
            if (opts?.once)
                break;
        }
        catch (e) {
            console.error("worker loop error:", (0, rateLimit_1.sanitizeErrorMessage)(e));
            if (opts?.once) {
                return {
                    totalJobsScanned,
                    jobsProcessed,
                    jobsSkipped,
                    jobsFailed,
                    executionDurationMs: Date.now() - startTimeMs,
                    success: false,
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
    };
}
// Run as standalone script
// (tsc -> CJS) so `require.main === module` works after compilation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
    const once = !!process.env.WORKER_ONCE;
    startAnalysisWorkerLoop({ once }).catch((e) => {
        console.error("worker fatal:", e);
        process.exit(1);
    });
}
