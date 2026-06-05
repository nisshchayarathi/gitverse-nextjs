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
    // Atomic: increment current request count and set TTL if this is the first request
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    if (!results) {
      // Redis failure — fail open (allow request, log warning)
      console.warn(
        "[RateLimit] Redis pipeline returned null — failing open for key:",
        key,
      );
      return {
        allowed: true,
        remaining: limit,
        windowSec,
        limit,
        resetInSec: windowSec,
      };
    }

    const [incrResult, ttlResult] = results;
    const count = (incrResult[1] as number) ?? 0;
    let ttl = (ttlResult[1] as number) ?? -1;

    // Set expiry on the first request in this window
    if (ttl < 0) {
      await redis.expire(key, windowSec);
      ttl = windowSec;
    }

    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;
    const resetInSec = ttl > 0 ? ttl : windowSec;

    return { allowed, remaining, windowSec, limit, resetInSec };
  } catch (err) {
    // Redis unavailable — fail open to avoid outages
    console.error("[RateLimit] Redis error — failing open:", err);
    return {
      allowed: true,
      remaining: limit,
      windowSec,
      limit,
      resetInSec: windowSec,
    };
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
