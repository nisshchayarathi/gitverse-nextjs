"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAnalysisWorkerLoop = startAnalysisWorkerLoop;
require("dotenv/config");
const os_1 = __importDefault(require("os"));
const prisma_1 = require("../lib/prisma");
const analysisJobService_1 = require("../lib/services/analysisJobService");
const repositoryService_1 = require("../lib/services/repositoryService");
process.on("unhandledRejection", async (reason) => {
    console.error("FATAL unhandled rejection \u2014 worker will exit:", reason);
    await (0, prisma_1.disconnectPrisma)();
    process.exit(1);
});
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LOCK_MS = 5 * 60_000;
const GRACE_PERIOD_MS = 30_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getWorkerId() {
    return (process.env.WORKER_ID ||
        `${os_1.default.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`);
}
let currentJob = null;
let jobRunning = false;
let stopping = false;
let forcedExitTimer = null;
async function runJob(job, params) {
    currentJob = job;
    jobRunning = true;
    let heartbeatTimer = null;
    let lastProgressWriteAt = 0;
    let lastProgressPercent;
    let lastProgressMessage;
    const writeProgress = async (update) => {
        if (stopping) {
            console.log(`stop requested, skipping progress write for job ${job.id}`);
            return;
        }
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
            if (stopping) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
                return;
            }
            analysisJobService_1.analysisJobService
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
        const details = job.progressDetails;
        const scope = details?.scope;
        await repositoryService_1.repositoryService.analyzeRepository(job.repositoryId, job.userId, {
            scope,
            onProgress: async (update) => {
                await writeProgress(update);
            },
        });
        if (stopping) {
            currentJob = null;
            jobRunning = false;
            return;
        }
        await analysisJobService_1.analysisJobService.markDone({
            jobId: job.id,
            workerId: params.workerId,
        });
    }
    catch (err) {
        const message = err?.message ? String(err.message) : String(err);
        console.error(`Job ${job.id} failed:`, err);
        if (stopping) {
            currentJob = null;
            jobRunning = false;
            return;
        }
        await analysisJobService_1.analysisJobService.markFailed({
            jobId: job.id,
            workerId: params.workerId,
            error: message,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
        });
    }
    finally {
        if (heartbeatTimer)
            clearInterval(heartbeatTimer);
        currentJob = null;
        jobRunning = false;
    }
}
async function startAnalysisWorkerLoop(opts) {
    const workerId = opts?.workerId || getWorkerId();
    const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
    const heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    const lockMs = opts?.lockMs ?? LOCK_MS;
    const gracePeriodMs = opts?.gracePeriodMs ?? GRACE_PERIOD_MS;
    const registerHandlers = opts?.signalHandlers !== false;
    console.log(`analysis worker starting: ${workerId}`);
    const shutdown = async (signal) => {
        if (stopping)
            return;
        stopping = true;
        console.log(`received ${signal}, draining active job...`);
        if (jobRunning && currentJob) {
            console.log(`draining job ${currentJob.id}`);
            const drainError = `Worker shut down by ${signal} — job released`;
            try {
                await analysisJobService_1.analysisJobService.markDrainReleased({
                    jobId: currentJob.id,
                    workerId,
                    error: drainError,
                });
                console.log(`job ${currentJob.id} drain-released ok`);
            }
            catch (e) {
                console.error(`drain markDrainReleased failed for job ${currentJob.id}:`, e);
                try {
                    await analysisJobService_1.analysisJobService.releaseLock({
                        jobId: currentJob.id,
                        workerId,
                    });
                    console.log(`job ${currentJob.id} lock fallback-released`);
                }
                catch (e2) {
                    console.error(`fallback lock release also failed for job ${currentJob.id}:`, e2);
                }
            }
        }
        forcedExitTimer = setTimeout(() => {
            console.error(`graceful shutdown timed out after ${gracePeriodMs}ms, forcing exit`);
            (0, prisma_1.disconnectPrisma)().finally(() => process.exit(1));
        }, gracePeriodMs);
        await (0, prisma_1.disconnectPrisma)();
    };
    if (registerHandlers) {
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
        process.on("SIGHUP", () => void shutdown("SIGHUP"));
    }
    while (!stopping) {
        try {
            await analysisJobService_1.analysisJobService.reclaimOrphanedJobs();
            const job = await analysisJobService_1.analysisJobService.claimNextJob({
                workerId,
                lockMs,
            });
            if (!job) {
                if (opts?.once)
                    return;
                await sleep(pollIntervalMs);
                continue;
            }
            console.log(`claimed job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
            await runJob(job, { workerId, lockMs, heartbeatIntervalMs });
            if (opts?.once)
                return;
        }
        catch (e) {
            console.error("worker loop error:", e);
            if (opts?.once)
                return;
            await sleep(pollIntervalMs);
        }
    }
}
const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
    const once = !!process.env.WORKER_ONCE;
    startAnalysisWorkerLoop({ once, signalHandlers: true }).catch(async (e) => {
        console.error("worker fatal:", e);
        await (0, prisma_1.disconnectPrisma)();
        process.exit(1);
    });
}
