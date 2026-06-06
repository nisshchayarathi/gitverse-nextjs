import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import CircuitBreaker from "opossum";
import { LRUCache } from "lru-cache";

export interface RateLimitConfig {
  namespace: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  fallbackFailed?: boolean;
}

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
} as const;

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60_000;

async function maybeCleanupExpired(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  try {
    await prisma.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Best-effort cleanup
  }
}

function buildRateLimitKey(namespace: string, identifier: string): string {
  const sanitized = identifier.replace(/[^\w@.:\-]/g, "_");
  return `${namespace}:${sanitized}`;
}

// 1. LRU Cache Fallback
const fallbackCache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10000,
  ttl: 1000 * 60 * 60,
});

// 2. Circuit Breaker for DB operations
const dbLimiterCircuit = new CircuitBreaker(
  async ({ key, config, now, expiresAt }: { key: string, config: RateLimitConfig, now: Date, expiresAt: Date }) => {
    void maybeCleanupExpired();
    const count = await prisma.rateLimit.count({
      where: {
        key,
        expiresAt: { gte: now },
      },
    });

    if (count >= config.maxRequests) {
      const oldestEntry = await prisma.rateLimit.findFirst({
        where: { key, expiresAt: { gte: now } },
        orderBy: { expiresAt: "asc" },
        select: { expiresAt: true },
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestEntry ? oldestEntry.expiresAt.getTime() : now.getTime() + config.windowMs,
        limit: config.maxRequests,
      };
    }

    await prisma.rateLimit.create({
      data: { key, points: 1, expiresAt },
    });

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetAt: expiresAt.getTime(),
      limit: config.maxRequests,
    };
  },
  {
    timeout: 3000,       // 3s timeout
    errorThresholdPercentage: 50,
    resetTimeout: 10000, // 10s wait before retry
  }
);

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = buildRateLimitKey(config.namespace, identifier);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.windowMs);

  try {
    // 3. Fire circuit breaker
    return await dbLimiterCircuit.fire({ key, config, now, expiresAt }) as RateLimitResult;
  } catch (error: any) {
    if (error?.code === "P2002") {
      // Normal race condition handling, not a circuit failure
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        limit: config.maxRequests,
      };
    }

    console.error("[RateLimit DB] Circuit Breaker opened or DB failed, falling back to LRU:", error.message);

    try {
      // 4. Fallback to LRU Cache
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
      console.error("[RateLimit DB] LRU Fallback also failed:", fallbackErr);
      return {
        allowed: false, // Default to fail closed
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        limit: config.maxRequests,
        fallbackFailed: true, // Signal to webhook to DLQ
      };
    }
  }
}

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

export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return response;
}
