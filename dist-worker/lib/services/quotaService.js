"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const DEFAULT_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
class QuotaService {
    /**
     * Tracks individual requests to prevent high-frequency burst attacks.
     * Returns true if request is allowed, false if rate-limited.
     */
    static async checkWebhookRateLimit(key, limit, windowMs) {
        const now = new Date();
        try {
            // 1. Clean up expired records asynchronously
            void prisma_1.default.rateLimit.deleteMany({
                where: { expiresAt: { lt: now } },
            }).catch(err => console.error("Rate limit cleanup failed:", err));
            // 2. Count active requests
            const count = await prisma_1.default.rateLimit.count({
                where: {
                    key,
                    expiresAt: { gte: now }
                },
            });
            if (count >= limit) {
                return false;
            }
            // 3. Record new request
            await prisma_1.default.rateLimit.create({
                data: {
                    key,
                    points: 1,
                    expiresAt: new Date(now.getTime() + windowMs),
                },
            });
            return true;
        }
        catch (error) {
            console.error("Error checking webhook rate limit:", error);
            // If DB fails, allow to prevent dropping valid webhooks
            return true;
        }
    }
    /**
     * Checks if an installation has AI analysis quota remaining.
     * If available, it atomically reserves 1 request.
     */
    static async checkAndReserveQuota(installationId) {
        try {
            const defaultMaxAnalyses = process.env.AI_QUOTA_PER_WINDOW
                ? parseInt(process.env.AI_QUOTA_PER_WINDOW, 10)
                : 250;
            let quota = await prisma_1.default.aiQuota.findUnique({
                where: { installationId },
            });
            const now = new Date();
            if (!quota) {
                quota = await prisma_1.default.aiQuota.create({
                    data: {
                        installationId,
                        requestsUsed: 0,
                        tokensConsumed: 0,
                        quotaWindowStart: now,
                        quotaWindowEnd: new Date(now.getTime() + DEFAULT_QUOTA_WINDOW_MS),
                        warningPosted: false,
                    },
                });
            }
            else if (quota.quotaWindowEnd < now) {
                // Reset window
                quota = await prisma_1.default.aiQuota.update({
                    where: { id: quota.id },
                    data: {
                        requestsUsed: 0,
                        tokensConsumed: 0,
                        quotaWindowStart: now,
                        quotaWindowEnd: new Date(now.getTime() + DEFAULT_QUOTA_WINDOW_MS),
                        warningPosted: false,
                    },
                });
            }
            // Check against limits
            if (quota.requestsUsed >= defaultMaxAnalyses) {
                return false;
            }
            // Reserve
            await prisma_1.default.aiQuota.update({
                where: { id: quota.id },
                data: {
                    requestsUsed: { increment: 1 },
                    lastAnalysisAt: now,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Error in checkAndReserveQuota:", error);
            // Fail closed to protect resources when quota system errors out
            return false;
        }
    }
    static async recordTokenUsage(installationId, tokens) {
        try {
            await prisma_1.default.aiQuota.update({
                where: { installationId },
                data: { tokensConsumed: { increment: tokens } },
            });
        }
        catch (e) {
            console.error("Error recording token usage:", e);
        }
    }
    static async markWarningPosted(installationId) {
        try {
            await prisma_1.default.aiQuota.update({
                where: { installationId },
                data: { warningPosted: true },
            });
        }
        catch (e) {
            console.error("Error marking warning posted:", e);
        }
    }
    static async hasWarningBeenPosted(installationId) {
        try {
            const quota = await prisma_1.default.aiQuota.findUnique({ where: { installationId } });
            return quota?.warningPosted || false;
        }
        catch (e) {
            console.error("Error checking warning posted status:", e);
            return true; // Assume posted to avoid spamming on DB errors
        }
    }
}
exports.QuotaService = QuotaService;
