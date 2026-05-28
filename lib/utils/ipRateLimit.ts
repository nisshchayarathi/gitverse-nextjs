/**
 * ipRateLimit.ts
 *
 * Lightweight in-process rate limiter for Next.js API routes.
 *
 * Limitations: per-process only. In a multi-replica or serverless deployment
 * each replica maintains its own counter, so the effective limit is
 * `maxRequests * replicaCount`. For stricter enforcement use a shared store
 * (Redis / Upstash). This implementation is intentionally kept dependency-free
 * and provides a meaningful improvement over having no limit at all.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
 *   if (!limiter.check(userId)) {
 *     return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 *   }
 */

interface RateLimiterOptions {
  /** Time window in milliseconds (default: 60 000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests allowed per key within the window (default: 20) */
  maxRequests?: number;
}

interface BucketEntry {
  count: number;
  windowStart: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 20;

  // Map of key -> { count, windowStart }.
  // Stale buckets are pruned on each check to prevent unbounded memory growth.
  const buckets = new Map<string, BucketEntry>();

  return {
    /**
     * Returns true if the key is within the allowed rate, false if it should
     * be throttled.
     */
    check(key: string): boolean {
      const now = Date.now();

      // Prune expired entries every call (cheap for small maps)
      for (const [k, entry] of buckets) {
        if (now - entry.windowStart >= windowMs) {
          buckets.delete(k);
        }
      }

      const entry = buckets.get(key);

      if (!entry || now - entry.windowStart >= windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return true;
      }

      if (entry.count >= maxRequests) {
        return false;
      }

      entry.count += 1;
      return true;
    },
  };
}
