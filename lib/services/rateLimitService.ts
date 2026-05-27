import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export type AttemptType = "LOGIN" | "SIGNUP" | "CHANGE_PASSWORD" | "DELETE_ACCOUNT";

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

export async function isRateLimited(
  key: string,
  type: AttemptType,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  try {
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
    console.error("Rate limit check failed, allowing request:", error);
    return false;
  }
}

export async function countAttempts(
  key: string,
  type: AttemptType,
  windowMs: number
): Promise<number> {
  try {
    const since = new Date(Date.now() - windowMs);

    return await prisma.loginAttempt.count({
      where: {
        key,
        type,
        createdAt: { gte: since },
      },
    });
  } catch (error) {
    console.error("Rate limit count failed:", error);
    return 0;
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
    console.error("Failed to record rate limit attempt:", error);
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
    console.error("Failed to clear rate limit attempts:", error);
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
