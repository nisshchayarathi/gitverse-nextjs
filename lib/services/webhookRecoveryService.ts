import prisma from "@/lib/prisma";
import { nextRetryDate } from "@/lib/utils/retry";

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * TTL for webhook event records.
 * Events are deleted after this many days to prevent unbounded database growth.
 * Terminal states (completed, failed, dlq) are pruned.
 * Active states (pending, processing) are never auto-deleted.
 */
const WEBHOOK_RETENTION_DAYS = 30;

/**
 * Recovery service uses longer backoff delays than the worker
 * (1 minute base, 30 minute max) since recovery runs periodically
 * and doesn't need to be as aggressive.
 */
const RECOVERY_RETRY_CONFIG = {
  baseDelayMs: 60 * 1000,
  maxDelayMs: 30 * 60 * 1000,
} as const;

export async function recoverStuckEvents(): Promise<{
  recovered: number;
  retried: number;
  skipped: number;
}> {
  const now = new Date();
  let recovered = 0;
  let retried = 0;
  let skipped = 0;

  // 1. Reset "processing" events that have been stuck beyond the threshold
  const stuckEvents = await prisma.webhookEvent.findMany({
    where: {
      status: "processing",
      updatedAt: { lt: new Date(now.getTime() - STUCK_THRESHOLD_MS) },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const event of stuckEvents) {
    const currentRetryCount = (event as any).retryCount ?? 0;
    const maxRetries = (event as any).maxRetries ?? 3;

    if (currentRetryCount >= maxRetries) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "dlq",
          error: "Exceeded max retries after stuck recovery",
          retryCount: currentRetryCount,
        },
      });
      skipped++;
      continue;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "pending",
        retryCount: currentRetryCount + 1,
        nextRetryAt: nextRetryDate(currentRetryCount, RECOVERY_RETRY_CONFIG),
        error: `Recovering from stuck state (attempt ${currentRetryCount + 1}/${maxRetries})`,
      },
    });
    recovered++;
  }

  // 2. Re-trigger "pending" events that are due for retry (set by worker on failure)
  const pendingRetryEvents = await prisma.webhookEvent.findMany({
    where: {
      status: "pending",
      nextRetryAt: {
        lte: now,
        not: null,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const event of pendingRetryEvents) {
    const currentRetryCount = (event as any).retryCount ?? 0;
    const maxRetries = (event as any).maxRetries ?? 3;

    if (currentRetryCount >= maxRetries) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "dlq",
          error: "Exceeded max retries",
          nextRetryAt: null,
        },
      });
      skipped++;
      continue;
    }

    // Mark as processing so the worker can pick it up
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "pending",
        nextRetryAt: null,
      },
    });
    retried++;
  }

  // 3. Retry "failed" events that are due for retry (legacy path)
  const failedEvents = await prisma.webhookEvent.findMany({
    where: {
      status: "failed",
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const event of failedEvents) {
    const currentRetryCount = (event as any).retryCount ?? 0;
    const maxRetries = (event as any).maxRetries ?? 3;

    if (currentRetryCount >= maxRetries) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "dlq" }
      });
      skipped++;
      continue;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "pending",
        retryCount: currentRetryCount + 1,
        nextRetryAt: nextRetryDate(currentRetryCount, RECOVERY_RETRY_CONFIG),
      },
    });
    retried++;
  }

  return { recovered, retried, skipped };
}

/**
 * Prunes webhook event records older than WEBHOOK_RETENTION_DAYS.
 * Only terminal states are deleted: completed, failed, dlq.
 * Active states (pending, processing) are preserved.
 */
export async function pruneExpiredWebhookEvents(): Promise<{
  deleted: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WEBHOOK_RETENTION_DAYS);

  const result = await prisma.webhookEvent.deleteMany({
    where: {
      status: { in: ["completed", "failed", "dlq"] },
      createdAt: { lt: cutoff },
    },
  });

  console.log(
    `[WebhookPrune] Deleted ${result.count} webhook events older than ${WEBHOOK_RETENTION_DAYS} days`
  );

  return { deleted: result.count };
}
