import * as path from "path";
import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/services/duplicateFeatureDetector";
import { requireAuth } from "@/lib/middleware";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";

const CACHE_TTL_MS = Number(process.env.DUPLICATE_FEATURE_CACHE_TTL_MS ?? "300000");
const ANALYSIS_TIMEOUT_MS = Number(process.env.DUPLICATE_FEATURE_ANALYSIS_TIMEOUT_MS ?? "20000");
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.DUPLICATE_FEATURE_RATE_LIMIT_PER_MINUTE ?? "5");

const cache = new Map<string, { expiresAt: number; features: Awaited<ReturnType<typeof analyzeRepository>> }>();
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    (request as any).ip ||
    "unknown"
  );
}

function enforceRateLimit(request: NextRequest) {
  const key = getClientKey(request);
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    const response = NextResponse.json(
      {
        ok: false,
        error: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );

    throw response;
  }

  rateLimits.set(key, { count: current.count + 1, resetAt: current.resetAt });
}

export async function GET(request: NextRequest) {
  await requireAuth(request);
  enforceRateLimit(request);

  const rootDir = process.env.DUPLICATE_FEATURE_REPO_ROOT
    ? path.resolve(process.env.DUPLICATE_FEATURE_REPO_ROOT)
    : process.cwd();

  const now = Date.now();
  const cacheEntry = cache.get(rootDir);
  if (cacheEntry && cacheEntry.expiresAt > now) {
    return NextResponse.json({ ok: true, features: cacheEntry.features });
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const features = await analyzeRepository(rootDir, {
      signal: abortController.signal,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    cache.set(rootDir, {
      expiresAt: now + CACHE_TTL_MS,
      features,
    });

    return NextResponse.json({ ok: true, features });
  } catch (error: unknown) {
    console.error("GET /api/analysis/duplicate-features error:", error);

    if (error instanceof Response) {
      return error;
    }

    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
