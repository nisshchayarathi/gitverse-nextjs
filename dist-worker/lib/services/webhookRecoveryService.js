"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverStuckEvents = recoverStuckEvents;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const RETRY_BACKOFF_BASE_MS = 60 * 1000; // 1 minute base
const MAX_RETRY_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes max
function getRetryDelay(retryCount) {
    const delay = Math.min(RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount), MAX_RETRY_BACKOFF_MS);
    return new Date(Date.now() + delay);
}
async function recoverStuckEvents() {
    const now = new Date();
    let recovered = 0;
    let retried = 0;
    let skipped = 0;
    // 1. Reset "processing" events that have been stuck beyond the threshold
    const stuckEvents = await prisma_1.default.webhookEvent.findMany({
        where: {
            status: "processing",
            updatedAt: { lt: new Date(now.getTime() - STUCK_THRESHOLD_MS) },
        },
        orderBy: { createdAt: "asc" },
    });
    for (const event of stuckEvents) {
        const currentRetryCount = event.retryCount ?? 0;
        const maxRetries = event.maxRetries ?? 3;
        if (currentRetryCount >= maxRetries) {
            await prisma_1.default.webhookEvent.update({
                where: { id: event.id },
                data: {
                    status: "failed",
                    error: "Exceeded max retries after stuck recovery",
                    retryCount: currentRetryCount,
                },
            });
            skipped++;
            continue;
        }
        await prisma_1.default.webhookEvent.update({
            where: { id: event.id },
            data: {
                status: "pending",
                retryCount: currentRetryCount + 1,
                nextRetryAt: getRetryDelay(currentRetryCount),
                error: `Recovering from stuck state (attempt ${currentRetryCount + 1}/${maxRetries})`,
            },
        });
        recovered++;
    }
    // 2. Retry "failed" events that are due for retry
    const failedEvents = await prisma_1.default.webhookEvent.findMany({
        where: {
            status: "failed",
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
            ],
        },
        orderBy: { createdAt: "asc" },
        take: 10,
    });
    for (const event of failedEvents) {
        const currentRetryCount = event.retryCount ?? 0;
        const maxRetries = event.maxRetries ?? 3;
        if (currentRetryCount >= maxRetries) {
            skipped++;
            continue;
        }
        await prisma_1.default.webhookEvent.update({
            where: { id: event.id },
            data: {
                status: "pending",
                retryCount: currentRetryCount + 1,
                nextRetryAt: getRetryDelay(currentRetryCount),
            },
        });
        retried++;
    }
    return { recovered, retried, skipped };
}
