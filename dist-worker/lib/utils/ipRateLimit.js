"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAiRateLimit = checkAiRateLimit;
exports.logAiRequest = logAiRequest;
exports.cleanupStaleLogs = cleanupStaleLogs;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;
async function cleanupStaleLogs() {
    const now = Date.now();
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS)
        return;
    lastCleanupAt = now;
    try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await prisma_1.default.aiRequestLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });
    }
    catch (error) {
        console.error("AI request log cleanup failed:", error);
    }
}
async function checkAiRateLimit(key, field, endpoint, maxRequests = 20, windowMs = 60_000) {
    try {
        void cleanupStaleLogs();
        const since = new Date(Date.now() - windowMs);
        const where = field === "userId"
            ? { userId: Number(key), endpoint, createdAt: { gte: since } }
            : { ip: key, endpoint, createdAt: { gte: since } };
        const count = await prisma_1.default.aiRequestLog.count({ where });
        return count < maxRequests;
    }
    catch (error) {
        console.error("AI rate limit check failed, allowing request:", error);
        return true;
    }
}
async function logAiRequest(params) {
    try {
        await prisma_1.default.aiRequestLog.create({
            data: {
                userId: params.userId ?? null,
                ip: params.ip,
                endpoint: params.endpoint,
            },
        });
    }
    catch (error) {
        console.error("Failed to log AI request:", error);
    }
}
