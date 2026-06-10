import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;

export type AttemptType =
  | "LOGIN"
  | "SIGNUP"
  | "CHANGE_PASSWORD"
  | "DELETE_ACCOUNT"
  | "REPOSITORY_ANALYSIS"
  | "ANALYSIS_RUNNER";

const RETENTION_DAYS = 7;

function getRetentionThreshold(): Date {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && ip !== "unknown") return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp !== "unknown") return realIp;
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
  } catch (error) {
    console.error("Background stale attempt cleanup failed:", error);
  }
}

export async function isRateLimited(
  key: string,
  type: AttemptType,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  try {
    void maybeCleanupStaleAttempts();
    const since = new Date(Date.now() - windowMs);

    const count = await prisma.loginAttempt.count({
      where: {
        key,
        type,
        createdAt: { gte: since },
        success: false,
      },
    });

    return count >= maxAttempts;
  } catch (error) {
    console.error(`Rate limit check failed for key=${key} type=${type}:`, error);
    throw error;
  }
}

export async function isAnalysisRunnerRateLimited(
  workerId: string,
): Promise<boolean> {
  const maxJobsPerMinute = 10;
  const windowMs = 60 * 1000;

  try {
    const since = new Date(Date.now() - windowMs);
    const count = await prisma.loginAttempt.count({
      where: {
        key: `runner:${workerId}`,
        type: "ANALYSIS_RUNNER",
        createdAt: { gte: since },
      },
    });

    return count >= maxJobsPerMinute;
  } catch (error) {
    console.error(`Analysis runner rate limit check failed for worker=${workerId}:`, error);
    throw error;
  }
}

export async function countAttempts(
  key: string,
  type: AttemptType,
  windowMs: number
): Promise<number> {
  try {
    void maybeCleanupStaleAttempts();
    const since = new Date(Date.now() - windowMs);

    return await prisma.loginAttempt.count({
      where: {
        key,
        type,
        createdAt: { gte: since },
      },
    });
  } catch (error) {
    console.error(`Rate limit count failed for key=${key} type=${type}:`, error);
    throw error;
  }
}

export async function recordAttempt(params: {
  key: string;
  type: AttemptType;
  success: boolean;
  email?: string;
  userId?: number;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        key: params.key,
        type: params.type,
        success: params.success,
        email: params.email ?? null,
        userId: params.userId ?? null,
      },
    });
  } catch (error) {
    console.error(`Failed to record rate limit attempt key=${params.key} type=${params.type}:`, error);
    throw error;
  }
}

export async function recordAnalysisRunnerAttempt(
  workerId: string,
  jobId: string,
  success: boolean,
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        key: `runner:${workerId}`,
        type: "ANALYSIS_RUNNER",
        success,
        email: null,
        userId: null,
      },
    });
  } catch (error) {
    console.error(`Failed to record analysis runner attempt worker=${workerId} job=${jobId}:`, error);
    throw error;
  }
}

export async function clearFailedAttempts(
  key: string,
  type: AttemptType
): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: {
        key,
        type,
        success: false,
      },
    });
  } catch (error) {
    console.error(`Failed to clear rate limit attempts key=${key} type=${type}:`, error);
  }
}

export async function cleanupStaleAttempts(): Promise<number> {
  try {
    const result = await prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: getRetentionThreshold() },
      },
    });
    return result.count;
  } catch (error) {
    console.error("Failed to clean up stale attempts:", error);
    return 0;
  }
}
