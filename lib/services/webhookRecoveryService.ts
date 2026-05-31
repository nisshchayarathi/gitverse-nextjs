import prisma from "@/lib/prisma";

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const RETRY_BACKOFF_BASE_MS = 60 * 1000; // 1 minute base
const MAX_RETRY_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes max

function getRetryDelay(retryCount: number): Date {
  const delay = Math.min(
    RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount),
    MAX_RETRY_BACKOFF_MS,
  );
  return new Date(Date.now() + delay);
}

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
          status: "failed",
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
        nextRetryAt: getRetryDelay(currentRetryCount),
        error: `Recovering from stuck state (attempt ${currentRetryCount + 1}/${maxRetries})`,
      },
    });
    recovered++;
  }

  // 2. Re-trigger "pending" events that are due for retry (set by worker on failure)
  const pendingRetryEvents = await prisma.webhookEvent.findMany({
    where: {
      status: "pending",
      nextRetryAt: { lte: now },
      nextRetryAt: { not: null },
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
          status: "failed",
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
      skipped++;
      continue;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "pending",
        retryCount: currentRetryCount + 1,
        nextRetryAt: getRetryDelay(currentRetryCount),
      },
    });
    retried++;
  }

  return { recovered, retried, skipped };
}
