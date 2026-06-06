import prisma from "../prisma";
import { WebhookQueueStatus } from "../../types/database-health";
import { webhookQueueInstance } from "../queue/webhookQueue";

type QueuedWebhook = {
  event: string;
  action: string | undefined;
  payload: any;
  status: string;
  deliveryId?: string;
};

const globalForQueue = globalThis as unknown as {
  webhookBuffer: QueuedWebhook[];
  webhookFlushTimeout: NodeJS.Timeout | null;
};

if (!globalForQueue.webhookBuffer) {
  globalForQueue.webhookBuffer = [];
}
if (!globalForQueue.webhookFlushTimeout) {
  globalForQueue.webhookFlushTimeout = null;
}

export class WebhookQueueService {
  /**
   * Enqueues a webhook event in memory and schedules a background flush.
   */
<<<<<<< HEAD
  enqueueWebhook(
    payload: any,
    event: string,
    action: string | undefined,
    baseUrl: string,
  ) {
=======
  enqueueWebhook(payload: any, event: string, action: string | undefined, baseUrl: string, deliveryId?: string) {
>>>>>>> ede0d665ec4d448aa73484ccb136b2157752c0da
    globalForQueue.webhookBuffer.push({
      event: event || "unknown",
      action: action,
      payload,
      status: "pending",
      deliveryId,
    });

    if (!globalForQueue.webhookFlushTimeout) {
      globalForQueue.webhookFlushTimeout = setTimeout(() => {
        this.flushWebhooks(baseUrl).catch(console.error);
      }, 500); // Batch after 500ms
    }
  }

  private async flushWebhooks(baseUrl: string) {
    const batch = globalForQueue.webhookBuffer.splice(
      0,
      globalForQueue.webhookBuffer.length,
    );
    globalForQueue.webhookFlushTimeout = null;

    if (batch.length === 0) return;

    try {
      // Use transaction to create rows and get their IDs back
      const createdEvents = await prisma.$transaction(
        batch.map((data) =>
          prisma.webhookEvent.create({
            data,
            select: { id: true },
          })
        )
      );

      // After flushing, enqueue to BullMQ
      for (const event of createdEvents) {
        await webhookQueueInstance.add("process-webhook", { eventId: event.id });
      }
    } catch (error) {
      console.error("[WebhookQueue] Failed to flush webhooks:", error);
      // Push back to queue on failure
      globalForQueue.webhookBuffer.unshift(...batch);

      // Retry in 5s
      if (!globalForQueue.webhookFlushTimeout) {
        globalForQueue.webhookFlushTimeout = setTimeout(() => {
          this.flushWebhooks(baseUrl).catch(console.error);
        }, 5000);
      }
    }
  }

  /**
   * Attempts to trigger pending webhooks up to the maximum concurrent capacity.
   * @deprecated Triggering is now handled by BullMQ workers automatically.
   */
  async triggerWorkers(baseUrl: string): Promise<WebhookQueueStatus> {
    const activeWorkers = await prisma.webhookEvent.count({
      where: { status: "processing" },
    });

    const pendingJobs = await prisma.webhookEvent.count({
      where: { status: "pending" },
    });

<<<<<<< HEAD
      if (activeWorkers >= MAX_CONCURRENT_WEBHOOKS) {
        console.log(
          `[WebhookQueue] Throttled. ${activeWorkers}/${MAX_CONCURRENT_WEBHOOKS} active workers. ${pendingJobs} jobs pending.`,
        );
        return { activeWorkers, pendingJobs, isThrottled: true };
      }

      const availableCapacity = MAX_CONCURRENT_WEBHOOKS - activeWorkers;
      if (pendingJobs === 0 || availableCapacity <= 0) {
        return { activeWorkers, pendingJobs, isThrottled: false };
      }

      // Fetch oldest pending jobs up to available capacity
      const nextJobs = await prisma.webhookEvent.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: availableCapacity,
      });

      if (nextJobs.length === 0) {
        return { activeWorkers, pendingJobs, isThrottled: false };
      }

      console.log(`[WebhookQueue] Dispatching ${nextJobs.length} new jobs...`);

      const internalSecret = process.env.INTERNAL_WORKER_SECRET;
      if (!internalSecret) {
        throw new Error("INTERNAL_WORKER_SECRET not configured");
      }
      const internalToken = deriveBearerToken(internalSecret);
      const workerUrl = `${baseUrl}/api/internal/worker/webhook`;

      // Dispatch non-blocking fetches
      for (const job of nextJobs) {
        SafeHttpClient.fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: internalToken,
          },
          body: JSON.stringify({ eventId: job.id }),
          allowLocalhost: true, // Allow localhost since it is an internal route
        }).catch((err: any) => {
          console.error(
            `[WebhookQueue] Failed to trigger worker for job ${job.id}:`,
            err,
          );
        });
      }

      return {
        activeWorkers: activeWorkers + nextJobs.length,
        pendingJobs: pendingJobs - nextJobs.length,
        isThrottled: false,
      };
    } catch (error) {
      console.error("[WebhookQueue] Error in triggerWorkers:", error);
      return { activeWorkers: 0, pendingJobs: 0, isThrottled: true };
    }
=======
    return { activeWorkers, pendingJobs, isThrottled: false };
>>>>>>> ede0d665ec4d448aa73484ccb136b2157752c0da
  }
}

export const webhookQueue = new WebhookQueueService();
