import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import CircuitBreaker from "opossum";
import { LRUCache } from "lru-cache";

/**
 * Configuration for a single rate limit definition.
 * Each endpoint group uses one of these to define its limit window.
 */
export interface RateLimitConfig {
  /** Namespace prefix for the rate limit key, e.g. "repo:analyze" */
  namespace: string;
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Returned by checkRateLimit.  Callers should check the `allowed` field
 * before proceeding with the guarded operation and use the remaining/resetAt
 * fields to set response headers.
 */
export interface RateLimitResult {
  /** true if the request is within the configured limit */
  allowed: boolean;
  /** How many requests the caller can still make in this window */
  remaining: number;
  /** Unix timestamp (ms) when the current window resets */
  resetAt: number;
  /** The configured maxRequests for this rate limit */
  limit: number;
  /** Set to true when both the Redis and the LRU fallback have failed */
  fallbackFailed?: boolean;
}

/** Pre-defined rate limit configurations used across the API routes. */
export const RATE_LIMITS = {
  REPOSITORY_ANALYZE: { namespace: "repo:analyze", maxRequests: 5, windowMs: 60_000 },
  REPOSITORY_ARCHITECTURE: { namespace: "repo:architecture", maxRequests: 3, windowMs: 60_000 },
  REPOSITORY_KNOWLEDGE_REFRESH: { namespace: "repo:knowledge:refresh", maxRequests: 5, windowMs: 300_000 },
  FILE_CONTENT: { namespace: "file:content", maxRequests: 100, windowMs: 60_000 },
  ANNOTATION_WRITE: { namespace: "annotation:write", maxRequests: 30, windowMs: 60_000 },
  AVATAR_UPLOAD: { namespace: "upload:avatar", maxRequests: 5, windowMs: 3_600_000 },
  GITHUB_IMPORT: { namespace: "github:import", maxRequests: 10, windowMs: 3_600_000 },
  GITHUB_CONNECT: { namespace: "github:connect", maxRequests: 5, windowMs: 60_000 },
  GITHUB_WEBHOOK: { namespace: "github:webhook", maxRequests: 100, windowMs: 60_000 },
  INCIDENT_WEBHOOK: { namespace: "incident:webhook", maxRequests: 50, windowMs: 60_000 },
  ADMIN_DLQ: { namespace: "admin:dlq", maxRequests: 30, windowMs: 60_000 },
  ADMIN_DLQ_REPLAY: { namespace: "admin:dlq:replay", maxRequests: 20, windowMs: 60_000 },
  WORKER_WEBHOOK: { namespace: "worker:webhook", maxRequests: 50, windowMs: 60_000 },
  AI_GLOBAL: { namespace: "ai:global", maxRequests: 50, windowMs: 60_000 },
  REPOSITORY_CREATE_BURST: { namespace: "repo:create:burst", maxRequests: 3, windowMs: 60_000 },
  ANNOTATION_SYNC: { namespace: "annotation:sync", maxRequests: 10, windowMs: 60_000 },
  GITHUB_SELECT_REPOS: { namespace: "github:select-repos", maxRequests: 10, windowMs: 60_000 },
  GITHUB_CONNECTED_REPOS: { namespace: "github:connected-repos", maxRequests: 30, windowMs: 60_000 },
  WORKER_HEALTHZ: { namespace: "worker:healthz", maxRequests: 20, windowMs: 60_000 },
  ANALYZE_REPOSITORY: { namespace: "repo:submission", maxRequests: 5, windowMs: 60_000 },
  GITHUB_HEATMAP: { namespace: "github:heatmap", maxRequests: 30, windowMs: 60_000 },
} as const;

function buildRateLimitKey(namespace: string, identifier: string): string {
  const sanitized = identifier.replace(/[^\w@.:\-]/g, "_");
  return `rl:${namespace}:${sanitized}`;
}

/**
 * Compute the fixed-window expiry for a given timestamp.
 * All requests within the same clock interval (floor(now / windowMs)) share
 * the same expiry, which is what allows the Redis key to be shared atomically.
 */
export function getWindowExpiry(now: number, windowMs: number): Date {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return new Date(windowStart + windowMs);
}

const fallbackCache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10000,
  ttl: 1000 * 60 * 60,
});

const redisLimiterCircuit = new CircuitBreaker(
  async ({ key, config, windowSec }: { key: string; config: RateLimitConfig; windowSec: number }) => {
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

    const allowed = count <= config.maxRequests;
    const resetAt = Date.now() + ttl * 1000;
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
      limit: config.maxRequests,
    };
  },
  {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
  }
);

/**
 * Check whether `identifier` has exceeded the rate limit described by `config`.
 *
 * Uses a three-layer approach:
 *   1. Atomic Redis INCR + EXPIRE (via ioredis pipeline)
 *   2. opossum circuit breaker (fault isolation, 3 s timeout)
 *   3. In-memory LRU cache fallback (10 k entries, fail-open)
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = buildRateLimitKey(config.namespace, identifier);
  const windowSec = Math.ceil(config.windowMs / 1000);

  try {
    return await redisLimiterCircuit.fire({ key, config, windowSec }) as RateLimitResult;
  } catch (error: any) {
    console.error("[RateLimit Redis] Circuit Breaker opened or Redis failed, falling back to LRU:", error.message);

    try {
      const timeNow = Date.now();
      let record = fallbackCache.get(key);

      if (!record || record.resetAt <= timeNow) {
        record = { count: 0, resetAt: timeNow + config.windowMs };
      }

      record.count += 1;
      fallbackCache.set(key, record, { ttl: record.resetAt - timeNow });

      const allowed = record.count <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - record.count);

      return {
        allowed,
        remaining,
        limit: config.maxRequests,
        resetAt: record.resetAt,
      };
    } catch (fallbackErr) {
      console.error("[RateLimit Redis] LRU Fallback also failed:", fallbackErr);
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        limit: config.maxRequests,
        fallbackFailed: true,
      };
    }
  }
}

/**
 * Reset module-level state between tests.
 * Clears the LRU cache and closes the circuit breaker.
 */
export function _resetStateForTesting(): void {
  fallbackCache.clear();
  redisLimiterCircuit.close();
}

/**
 * Build a 429 JSON response with standard rate-limit headers and a human-
 * readable message.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message?: string,
): NextResponse {
  return NextResponse.json(
    {
      error: true,
      message: message ?? "Too many requests. Please wait before retrying.",
      code: 429,
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

/**
 * Attach X-RateLimit-* headers to an existing NextResponse.
 * This is useful when the route wants to return a non-429 response
 * (e.g. 200 OK) but still inform the client of their rate-limit status.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return response;
}
