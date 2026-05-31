import prisma from "@/lib/prisma";

const DEFAULT_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export class QuotaService {
  /**
   * Tracks individual requests to prevent high-frequency burst attacks.
   * Returns true if request is allowed, false if rate-limited.
   */
  static async checkWebhookRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = new Date();
    
    try {
      // 1. Clean up expired records asynchronously
      void prisma.rateLimit.deleteMany({
        where: { expiresAt: { lt: now } },
      }).catch(err => console.error("Rate limit cleanup failed:", err));

      // 2. Count active requests
      const count = await prisma.rateLimit.count({
        where: { 
          key, 
          expiresAt: { gte: now } 
        },
      });

      if (count >= limit) {
        return false;
      }

      // 3. Record new request
      await prisma.rateLimit.create({
        data: {
          key,
          points: 1,
          expiresAt: new Date(now.getTime() + windowMs),
        },
      });

      return true;
    } catch (error) {
      console.error("Error checking webhook rate limit:", error);
      // If DB fails, allow to prevent dropping valid webhooks
      return true; 
    }
  }

  /**
   * Checks if an installation has AI analysis quota remaining.
   * If available, it atomically reserves 1 request.
   */
  static async checkAndReserveQuota(installationId: bigint): Promise<boolean> {
    try {
      const defaultMaxAnalyses = process.env.AI_QUOTA_PER_WINDOW 
        ? parseInt(process.env.AI_QUOTA_PER_WINDOW, 10) 
        : 250;

      let quota = await prisma.aiQuota.findUnique({
        where: { installationId },
      });

      const now = new Date();

      if (!quota) {
        quota = await prisma.aiQuota.create({
          data: {
            installationId,
            requestsUsed: 0,
            tokensConsumed: 0,
            quotaWindowStart: now,
            quotaWindowEnd: new Date(now.getTime() + DEFAULT_QUOTA_WINDOW_MS),
            warningPosted: false,
          },
        });
      } else if (quota.quotaWindowEnd < now) {
        // Reset window
        quota = await prisma.aiQuota.update({
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
      await prisma.aiQuota.update({
        where: { id: quota.id },
        data: {
          requestsUsed: { increment: 1 },
          lastAnalysisAt: now,
        },
      });

      return true;
    } catch (error) {
      console.error("Error in checkAndReserveQuota:", error);
      // Fail closed to protect resources when quota system errors out
      return false;
    }
  }

  static async recordTokenUsage(installationId: bigint, tokens: number): Promise<void> {
    try {
      await prisma.aiQuota.update({
        where: { installationId },
        data: { tokensConsumed: { increment: tokens } },
      });
    } catch (e) {
      console.error("Error recording token usage:", e);
    }
  }

  static async markWarningPosted(installationId: bigint): Promise<void> {
    try {
      await prisma.aiQuota.update({
        where: { installationId },
        data: { warningPosted: true },
      });
    } catch (e) {
      console.error("Error marking warning posted:", e);
    }
  }

  static async hasWarningBeenPosted(installationId: bigint): Promise<boolean> {
    try {
      const quota = await prisma.aiQuota.findUnique({ where: { installationId } });
      return quota?.warningPosted || false;
    } catch (e) {
      console.error("Error checking warning posted status:", e);
      return true; // Assume posted to avoid spamming on DB errors
    }
  }
}
