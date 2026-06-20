/**
 * Redis-backed Token Bucket Rate Limiter
 *
 * Implements a sliding-window token bucket algorithm per user (or IP fallback).
 * Supports user-tier quotas (free vs. premium) for fine-grained control.
 *
 * Usage:
 *   const result = await rateLimiter(request, { endpoint: "ai:analyze", userId: 42 });
 *   if (!result.allowed) return rateLimitResponse(result);
 */

import redis from "@/lib/redis";
import { NextRequest, NextResponse } from "next/server";
import CircuitBreaker from "opossum";
import { LRUCache } from "lru-cache";

export type UserTier = "free" | "premium";

export interface RateLimitConfig {
  /** Logical endpoint key, e.g. "ai:analyze-repository" */
  endpoint: string;
  /** Authenticated user ID (preferred) */
  userId?: number;
  /** Fallback for unauthenticated requests */
  ip?: string;
  /** User subscription tier — controls quota */
  tier?: UserTier;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining tokens in current window */
  remaining: number;
  /** Window duration in seconds */
  windowSec: number;
  /** Max requests per window for this tier */
  limit: number;
  /** Seconds until the quota resets */
  resetInSec: number;
  /** Optional flag: set if both primary and fallback rate limiters failed */
  fallbackFailed?: boolean;
}

/**
 * Per-endpoint quota definitions (requests per window).
 * Free tier is intentionally restrictive on expensive AI routes.
 */
const QUOTA_MAP: Record<
  string,
  { free: number; premium: number; windowSec: number }
> = {
  "ai:analyze-repository": { free: 5, premium: 60, windowSec: 60 },
  "ai:chat": { free: 10, premium: 120, windowSec: 60 },
  "ai:explain-file": { free: 10, premium: 100, windowSec: 60 },
  "ai:generate-readme": { free: 3, premium: 30, windowSec: 60 },
  "ai:review-pr": { free: 5, premium: 60, windowSec: 60 },
  "mfa:verify": { free: 5, premium: 20, windowSec: 60 },
  "mfa:setup": { free: 5, premium: 20, windowSec: 300 },
  "users:change-password": { free: 10, premium: 30, windowSec: 300 },
  "repositories:file-content": { free: 30, premium: 300, windowSec: 60 },
  default: { free: 20, premium: 200, windowSec: 60 },
};

/**
 * Derive the bucket key used in Redis.
 * Format: rl:<endpoint>:<userId|ip>
 */
function buildKey(config: RateLimitConfig): string {
  const subject =
    config.userId != null
      ? `u:${config.userId}`
      : `ip:${config.ip ?? "unknown"}`;
  return `rl:${config.endpoint}:${subject}`;
}

// 1. LRU Cache Fallback
// Stores object: { count: number, resetAt: number }
const fallbackCache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10000,
  ttl: 1000 * 60 * 60, // 1 hour max TTL
});

// 2. Opossum Circuit Breaker
const redisLimiterCircuit = new CircuitBreaker(
  async (key: string, windowSec: number) => {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    if (!results) {
      throw new Error("Redis pipeline returned null");
    }

    const [incrResult, ttlResult] = results;
    // @ts-ignore
    if (incrResult[0]) throw incrResult[0];
    // @ts-ignore
    if (ttlResult[0]) throw ttlResult[0];

    const count = (incrResult[1] as number) ?? 0;
    let ttl = (ttlResult[1] as number) ?? -1;

    // Set expiry on the first request in this window
    if (ttl < 0) {
      await redis.expire(key, windowSec);
      ttl = windowSec;
    }

    return { count, ttl };
  },
  {
    timeout: 3000,       // 3 seconds timeout for Redis
    errorThresholdPercentage: 50,
    resetTimeout: 10000, // Wait 10s before trying again
  }
);

/**
 * Core token-bucket check using Redis atomic operations.
 * Uses INCR + EXPIRE to implement a fixed sliding window.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const quotaKey = config.endpoint in QUOTA_MAP ? config.endpoint : "default";
  const quota = QUOTA_MAP[quotaKey];
  const tier: UserTier = config.tier ?? "free";
  const limit = quota[tier];
  const windowSec = quota.windowSec;

  const key = buildKey(config);

  try {
    // 3. Try Redis with Circuit Breaker
    const { count, ttl } = await redisLimiterCircuit.fire(key, windowSec);
    
    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;
    const resetInSec = ttl > 0 ? ttl : windowSec;

    return { allowed, remaining, windowSec, limit, resetInSec };
  } catch (err: any) {
    console.error("[RateLimit] Circuit Breaker opened or Redis failed, falling back to LRU:", err.message);

    try {
      // 4. Fallback to LRU Cache
      const now = Date.now();
      let record = fallbackCache.get(key);

      if (!record || record.resetAt <= now) {
        // Expired or missing
        record = { count: 0, resetAt: now + windowSec * 1000 };
      }

      record.count += 1;
      
      // Update cache
      fallbackCache.set(key, record, { ttl: record.resetAt - now });

      const count = record.count;
      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;
      const resetInSec = Math.ceil((record.resetAt - now) / 1000);

      return { allowed, remaining, windowSec, limit, resetInSec };
    } catch (fallbackErr) {
      console.error("[RateLimit] LRU Fallback also failed:", fallbackErr);
      return {
        allowed: false, // Ensure we fail closed by default for safety on DB calls
        remaining: 0,
        windowSec,
        limit,
        resetInSec: windowSec,
        fallbackFailed: true, // Both primary and fallback failed!
      };
    }
  }
}

/**
 * Convenience function: returns a 429 response with Retry-After headers.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${result.resetInSec} second(s).`,
      retryAfter: result.resetInSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.resetInSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(
          Math.floor(Date.now() / 1000) + result.resetInSec,
        ),
      },
    },
  );
}

/**
 * Helper: extract client IP from Next.js request headers.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
