"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = getClientIp;
exports.isRateLimited = isRateLimited;
exports.countAttempts = countAttempts;
exports.recordAttempt = recordAttempt;
exports.clearFailedAttempts = clearFailedAttempts;
exports.cleanupStaleAttempts = cleanupStaleAttempts;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let lastCleanupAt = 0;
const RETENTION_DAYS = 7;
function getRetentionThreshold() {
    return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
function getClientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const ip = forwarded.split(",")[0]?.trim();
        if (ip && ip !== "unknown")
            return ip;
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp && realIp !== "unknown")
        return realIp;
    return request.ip ?? "unknown";
}
async function maybeCleanupStaleAttempts() {
    const now = Date.now();
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
        return;
    }
    lastCleanupAt = now;
    try {
        await cleanupStaleAttempts();
    }
    catch (error) {
        console.error("Background cleanup failed:", error);
    }
}
async function isRateLimited(key, type, maxAttempts, windowMs) {
    try {
        void maybeCleanupStaleAttempts();
        const since = new Date(Date.now() - windowMs);
        const count = await prisma_1.default.loginAttempt.count({
            where: {
                key,
                type,
                createdAt: { gte: since },
                success: false,
            },
        });
        return count >= maxAttempts;
    }
    catch (error) {
        console.error("Rate limit check failed, allowing request:", error);
        return false;
    }
}
async function countAttempts(key, type, windowMs) {
    try {
        void maybeCleanupStaleAttempts();
        const since = new Date(Date.now() - windowMs);
        return await prisma_1.default.loginAttempt.count({
            where: {
                key,
                type,
                createdAt: { gte: since },
            },
        });
    }
    catch (error) {
        console.error("Rate limit count failed:", error);
        return 0;
    }
}
async function recordAttempt(params) {
    try {
        await prisma_1.default.loginAttempt.create({
            data: {
                key: params.key,
                type: params.type,
                success: params.success,
                email: params.email ?? null,
                userId: params.userId ?? null,
            },
        });
    }
    catch (error) {
        console.error("Failed to record rate limit attempt:", error);
    }
}
async function clearFailedAttempts(key, type) {
    try {
        await prisma_1.default.loginAttempt.deleteMany({
            where: {
                key,
                type,
                success: false,
            },
        });
    }
    catch (error) {
        console.error("Failed to clear rate limit attempts:", error);
    }
}
async function cleanupStaleAttempts() {
    try {
        const result = await prisma_1.default.loginAttempt.deleteMany({
            where: {
                createdAt: { lt: getRetentionThreshold() },
            },
        });
        return result.count;
    }
    catch (error) {
        console.error("Failed to clean up stale attempts:", error);
        return 0;
    }
}
