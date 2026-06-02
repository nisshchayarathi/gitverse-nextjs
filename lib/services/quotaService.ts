import prisma from "@/lib/prisma";

const DEFAULT_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RATE_LIMIT_KEY_LENGTH = 255;
const MIN_RATE_LIMIT_KEY_LENGTH = 1;
const MIN_WINDOW_MS = 1000;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_CLEANUP_BATCH_SIZE = 1000;

export interface QuotaStatus {
  installationId: bigint;
  requestsUsed: number;
  maxRequests: number;
  windowStart: Date;
  windowEnd: Date;
  warningPosted: boolean;
  tokensConsumed: number;
  remainingRequests: number;
  utilizationPercent: number;
  isExpired: boolean;
  timeUntilResetMs: number;
}

export interface RateLimitStatus {
  key: string;
  currentCount: number;
  limit: number;
  windowMs: number;
  remaining: number;
  utilizationPercent: number;
  isExceeded: boolean;
}

export class QuotaService {
  /**
   * Validates rate limit parameters before processing.
   * Returns null if valid, or an error message if invalid.
   */
  static validateRateLimitParams(
    key: string,
    limit: number,
    windowMs: number
  ): string | null {
    if (typeof key !== "string") {
      return "Rate limit key must be a string";
    }

    if (key.length < MIN_RATE_LIMIT_KEY_LENGTH) {
      return "Rate limit key must not be empty";
    }

    if (key.length > MAX_RATE_LIMIT_KEY_LENGTH) {
      return `Rate limit key must not exceed ${MAX_RATE_LIMIT_KEY_LENGTH} characters`;
    }

    if (typeof limit !== "number" || !Number.isInteger(limit)) {
      return "Rate limit must be a positive integer";
    }

    if (limit <= 0) {
      return "Rate limit must be greater than zero";
    }

    if (limit > 100000) {
      return "Rate limit must not exceed 100,000";
    }

    if (typeof windowMs !== "number" || !Number.isFinite(windowMs)) {
      return "Window must be a finite number";
    }

    if (windowMs < MIN_WINDOW_MS) {
      return `Window must be at least ${MIN_WINDOW_MS}ms`;
    }

    if (windowMs > MAX_WINDOW_MS) {
      return `Window must not exceed ${MAX_WINDOW_MS}ms (7 days)`;
    }

    return null;
  }

  /**
   * Validates installation ID for quota operations.
   * Returns null if valid, or an error message if invalid.
   */
  static validateInstallationId(installationId: bigint): string | null {
    if (typeof installationId !== "bigint") {
      return "Installation ID must be a BigInt";
    }

    if (installationId <= 0n) {
      return "Installation ID must be a positive number";
    }

    if (installationId > BigInt(Number.MAX_SAFE_INTEGER)) {
      return "Installation ID exceeds maximum safe integer range";
    }

    return null;
  }

  /**
   * Sanitizes a rate limit key by removing control characters
   * and normalizing whitespace.
   */
  static sanitizeKey(key: string): string {
    return key
      .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
      .trim()                            // Trim whitespace first
      .replace(/\s+/g, ":");             // Replace remaining internal whitespace with colon
  }

  /**
   * Tracks individual requests to prevent high-frequency burst attacks.
   * Returns true if request is allowed, false if rate-limited.
   *
   * Uses a count-then-insert pattern with P2002 handling for race condition
   * resilience. The race window is narrow (one extra request maximum) and
   * the consequence is acceptable for rate limiting.
   *
   * Fail-open on DB errors: allows requests to avoid dropping valid webhooks
   * during database outages.
   */
  static async checkWebhookRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    const validationError = QuotaService.validateRateLimitParams(key, limit, windowMs);
    if (validationError) {
      console.error("Rate limit validation failed:", validationError);
      return false;
    }

    const sanitizedKey = QuotaService.sanitizeKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowMs);

    try {
      // Best-effort cleanup of expired records to prevent unbounded growth.
      // Runs asynchronously to avoid blocking the rate limit check.
      void prisma.rateLimit
        .deleteMany({
          where: { expiresAt: { lt: now } },
        })
        .catch((err) =>
          console.error("Rate limit cleanup failed:", err)
        );

      // Count active records for this key.
      // This is the "check" in the TOCTOU pattern. A concurrent request
      // could insert between this count and the create below, but the
      // unique constraint on (key, expiresAt) will cause the loser to
      // get a P2002 error, which we handle as rate-limited.
      const count = await prisma.rateLimit.count({
        where: {
          key: sanitizedKey,
          expiresAt: { gte: now },
        },
      });

      if (count >= limit) {
        return false;
      }

      // Record the request. Under concurrent load, the unique constraint
      // prevents double-counting: if two requests pass the count check
      // simultaneously, only one create succeeds; the other gets P2002.
      await prisma.rateLimit.create({
        data: {
          key: sanitizedKey,
          points: 1,
          expiresAt,
        },
      });

      return true;
    } catch (error: any) {
      // P2002 = Prisma unique constraint violation (race condition with
      // another request that inserted between our count and create).
      // Treat as rate-limited to enforce the limit.
      if (error?.code === "P2002") {
        return false;
      }

      console.error("Error checking webhook rate limit:", error);
      // Fail-open: allow the request to avoid dropping valid webhooks
      // during transient DB failures.
      return true;
    }
  }

  /**
   * Cleans up expired rate limit records.
   * Can be called periodically to prevent unbounded table growth.
   * Returns the number of deleted records.
   */
  static async cleanupExpiredRateLimits(
    batchSize: number = DEFAULT_CLEANUP_BATCH_SIZE
  ): Promise<number> {
    if (batchSize <= 0 || batchSize > 10000) {
      throw new Error("Batch size must be between 1 and 10,000");
    }

    try {
      const now = new Date();
      const result = await prisma.rateLimit.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      return result.count;
    } catch (error) {
      console.error("Error cleaning up expired rate limits:", error);
      return 0;
    }
  }

  /**
   * Gets the current rate limit status for a key without modifying state.
   * Useful for monitoring and debugging.
   */
  static async getRateLimitStatus(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitStatus> {
    const sanitizedKey = QuotaService.sanitizeKey(key);
    const now = new Date();

    try {
      const count = await prisma.rateLimit.count({
        where: {
          key: sanitizedKey,
          expiresAt: { gte: now },
        },
      });

      const remaining = Math.max(0, limit - count);
      const utilizationPercent = limit > 0 ? Math.round((count / limit) * 100) : 0;

      return {
        key: sanitizedKey,
        currentCount: count,
        limit,
        windowMs,
        remaining,
        utilizationPercent,
        isExceeded: count >= limit,
      };
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      return {
        key: sanitizedKey,
        currentCount: 0,
        limit,
        windowMs,
        remaining: limit,
        utilizationPercent: 0,
        isExceeded: false,
      };
    }
  }

  /**
   * Checks if an installation has AI analysis quota remaining.
   * If available, it atomically reserves 1 request using a conditional update.
   *
   * This avoids the TOCTOU race condition where two concurrent requests
   * could both see requestsUsed < max and both reserve, exceeding the quota.
   *
   * The atomic updateMany with a WHERE clause ensures that only one request
   * wins the increment when multiple concurrent requests race.
   *
   * Fail-closed on DB errors: rejects requests when the quota system is
   * uncertain, protecting AI resources from over-consumption.
   */
  static async checkAndReserveQuota(installationId: bigint): Promise<boolean> {
    const validationError = QuotaService.validateInstallationId(installationId);
    if (validationError) {
      console.error("Quota validation failed:", validationError);
      return false;
    }

    try {
      const defaultMaxAnalyses = QuotaService.getQuotaMax();
      const now = new Date();
      const windowEnd = new Date(now.getTime() + DEFAULT_QUOTA_WINDOW_MS);

      // Step 1: Ensure quota record exists (upsert).
      // For new installations, this creates the initial quota record.
      // For existing installations, this is a no-op (update: {}).
      await prisma.aiQuota.upsert({
        where: { installationId },
        create: {
          installationId,
          requestsUsed: 0,
          tokensConsumed: 0,
          quotaWindowStart: now,
          quotaWindowEnd: windowEnd,
          warningPosted: false,
        },
        update: {},
      });

      // Step 2: Atomic conditional increment.
      // Only increment if requestsUsed < maxAnalyses.
      // This is atomic at the DB level: the UPDATE ... WHERE requestsUsed < N
      // ensures that if two concurrent requests both read requestsUsed < N,
      // only one succeeds in incrementing (the DB row-level lock prevents both).
      const result = await prisma.aiQuota.updateMany({
        where: {
          installationId,
          requestsUsed: { lt: defaultMaxAnalyses },
        },
        data: {
          requestsUsed: { increment: 1 },
          lastAnalysisAt: now,
        },
      });

      // If updateMany affected 0 rows, either:
      // (a) quota is exhausted (requestsUsed >= max), or
      // (b) window expired and needs reset
      if (result.count === 0) {
        const quota = await prisma.aiQuota.findUnique({
          where: { installationId },
        });

        // If quota is null, the record was deleted between upsert and here.
        // This shouldn't happen in normal operation, but treat as exhausted.
        if (!quota) {
          return false;
        }

        // Check if the window has expired and needs reset
        if (quota.quotaWindowEnd < now) {
          // Reset the window: set requestsUsed to 1 (this request counts),
          // clear token consumption, and start a new window.
          await prisma.aiQuota.update({
            where: { id: quota.id },
            data: {
              requestsUsed: 1,
              tokensConsumed: 0,
              quotaWindowStart: now,
              quotaWindowEnd: windowEnd,
              warningPosted: false,
              lastAnalysisAt: now,
            },
          });
          return true;
        }

        // Window not expired and can't increment → truly exhausted
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in checkAndReserveQuota:", error);
      // Fail closed: reject when quota system is uncertain to protect
      // AI resources from over-consumption during DB outages.
      return false;
    }
  }

  /**
   * Returns the configured quota maximum, handling invalid env values.
   */
  static getQuotaMax(): number {
    const envValue = process.env.AI_QUOTA_PER_WINDOW;
    if (!envValue) {
      return 250;
    }

    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.warn(
        `Invalid AI_QUOTA_PER_WINDOW value: "${envValue}". Using default of 250.`
      );
      return 250;
    }

    if (parsed > 100000) {
      console.warn(
        `AI_QUOTA_PER_WINDOW value ${parsed} exceeds maximum of 100,000. Capping.`
      );
      return 100000;
    }

    return parsed;
  }

  /**
   * Gets the current quota status for an installation.
   * Useful for monitoring, dashboards, and user-facing quota displays.
   */
  static async getQuotaStatus(installationId: bigint): Promise<QuotaStatus | null> {
    const validationError = QuotaService.validateInstallationId(installationId);
    if (validationError) {
      return null;
    }

    try {
      const quota = await prisma.aiQuota.findUnique({
        where: { installationId },
      });

      if (!quota) {
        return null;
      }

      const maxRequests = QuotaService.getQuotaMax();
      const now = new Date();
      const isExpired = quota.quotaWindowEnd < now;
      const remainingRequests = isExpired
        ? maxRequests
        : Math.max(0, maxRequests - quota.requestsUsed);
      const utilizationPercent = maxRequests > 0
        ? Math.round((quota.requestsUsed / maxRequests) * 100)
        : 0;
      const timeUntilResetMs = isExpired
        ? 0
        : Math.max(0, quota.quotaWindowEnd.getTime() - now.getTime());

      return {
        installationId,
        requestsUsed: quota.requestsUsed,
        maxRequests,
        windowStart: quota.quotaWindowStart,
        windowEnd: quota.quotaWindowEnd,
        warningPosted: quota.warningPosted,
        tokensConsumed: quota.tokensConsumed,
        remainingRequests,
        utilizationPercent,
        isExpired,
        timeUntilResetMs,
      };
    } catch (error) {
      console.error("Error getting quota status:", error);
      return null;
    }
  }

  /**
   * Manually resets an installation's quota window.
   * Useful for admin operations or when an installation reports issues.
   */
  static async resetQuota(installationId: bigint): Promise<boolean> {
    const validationError = QuotaService.validateInstallationId(installationId);
    if (validationError) {
      console.error("Quota reset validation failed:", validationError);
      return false;
    }

    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + DEFAULT_QUOTA_WINDOW_MS);

      await prisma.aiQuota.upsert({
        where: { installationId },
        create: {
          installationId,
          requestsUsed: 0,
          tokensConsumed: 0,
          quotaWindowStart: now,
          quotaWindowEnd: windowEnd,
          warningPosted: false,
        },
        update: {
          requestsUsed: 0,
          tokensConsumed: 0,
          quotaWindowStart: now,
          quotaWindowEnd: windowEnd,
          warningPosted: false,
        },
      });

      return true;
    } catch (error) {
      console.error("Error resetting quota:", error);
      return false;
    }
  }

  /**
   * Records token consumption for an AI analysis.
   * Tokens are tracked separately from request counts to allow
   * fine-grained billing and usage monitoring.
   *
   * Errors are logged but not thrown to avoid disrupting the analysis
   * pipeline for non-critical bookkeeping failures.
   */
  static async recordTokenUsage(
    installationId: bigint,
    tokens: number
  ): Promise<void> {
    if (tokens < 0) {
      console.error("Token count must be non-negative, got:", tokens);
      return;
    }

    if (tokens === 0) {
      return;
    }

    try {
      await prisma.aiQuota.update({
        where: { installationId },
        data: { tokensConsumed: { increment: tokens } },
      });
    } catch (e) {
      console.error("Error recording token usage:", e);
    }
  }

  /**
   * Marks the quota warning as posted for an installation.
   * Used to prevent duplicate warning notifications in webhook pipelines.
   *
   * Errors are logged but not thrown to avoid disrupting the notification
   * pipeline for non-critical state tracking failures.
   */
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

  /**
   * Checks if a quota warning has already been posted for an installation.
   *
   * Returns true on DB errors (assumes warning was posted) to prevent
   * spamming users with duplicate warnings during transient failures.
   */
  static async hasWarningBeenPosted(installationId: bigint): Promise<boolean> {
    try {
      const quota = await prisma.aiQuota.findUnique({
        where: { installationId },
      });
      return quota?.warningPosted || false;
    } catch (e) {
      console.error("Error checking warning posted status:", e);
      return true; // Assume posted to avoid spamming on DB errors
    }
  }

  /**
   * Bulk checks quota status for multiple installations.
   * Useful for dashboard summaries and admin views.
   * Returns a map of installationId → status.
   */
  static async getBulkQuotaStatus(
    installationIds: bigint[]
  ): Promise<Map<bigint, QuotaStatus | null>> {
    const results = new Map<bigint, QuotaStatus | null>();

    if (installationIds.length === 0) {
      return results;
    }

    // Deduplicate IDs
    const uniqueIds = [...new Set(installationIds)];

    try {
      const quotas = await prisma.aiQuota.findMany({
        where: { installationId: { in: uniqueIds } },
      });

      const quotaMap = new Map(
        quotas.map((q) => [q.installationId, q])
      );

      const maxRequests = QuotaService.getQuotaMax();
      const now = new Date();

      for (const id of uniqueIds) {
        const quota = quotaMap.get(id);
        if (!quota) {
          results.set(id, null);
          continue;
        }

        const isExpired = quota.quotaWindowEnd < now;
        const remainingRequests = isExpired
          ? maxRequests
          : Math.max(0, maxRequests - quota.requestsUsed);
        const utilizationPercent = maxRequests > 0
          ? Math.round((quota.requestsUsed / maxRequests) * 100)
          : 0;
        const timeUntilResetMs = isExpired
          ? 0
          : Math.max(0, quota.quotaWindowEnd.getTime() - now.getTime());

        results.set(id, {
          installationId: id,
          requestsUsed: quota.requestsUsed,
          maxRequests,
          windowStart: quota.quotaWindowStart,
          windowEnd: quota.quotaWindowEnd,
          warningPosted: quota.warningPosted,
          tokensConsumed: quota.tokensConsumed,
          remainingRequests,
          utilizationPercent,
          isExpired,
          timeUntilResetMs,
        });
      }

      return results;
    } catch (error) {
      console.error("Error getting bulk quota status:", error);
      // Return empty results on failure
      for (const id of uniqueIds) {
        results.set(id, null);
      }
      return results;
    }
  }
}
