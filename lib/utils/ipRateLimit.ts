import prisma from "@/lib/prisma";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;

async function cleanupStaleLogs(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.aiRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  } catch (error) {
    console.error("AI request log cleanup failed:", error);
  }
}

async function checkAiRateLimit(
  key: string,
  field: "userId" | "ip",
  endpoint: string,
  maxRequests: number = 20,
  windowMs: number = 60_000
): Promise<boolean> {
  try {
    void cleanupStaleLogs();
    const since = new Date(Date.now() - windowMs);

    const where =
      field === "userId"
        ? { userId: Number(key), endpoint, createdAt: { gte: since } }
        : { ip: key, endpoint, createdAt: { gte: since } };

    const count = await prisma.aiRequestLog.count({ where });
    return count < maxRequests;
  } catch (error) {
    console.error("AI rate limit check failed, allowing request:", error);
    return true;
  }
}

async function logAiRequest(params: {
  userId?: number;
  ip: string;
  endpoint: string;
}): Promise<void> {
  try {
    await prisma.aiRequestLog.create({
      data: {
        userId: params.userId ?? null,
        ip: params.ip,
        endpoint: params.endpoint,
      },
    });
  } catch (error) {
    console.error("Failed to log AI request:", error);
  }
}

export { checkAiRateLimit, logAiRequest, cleanupStaleLogs };
