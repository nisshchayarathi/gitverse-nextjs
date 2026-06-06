import prisma from "../prisma";
import { WebhookQueueStatus } from "../../types/database-health";
import { webhookQueueInstance } from "../queue/webhookQueue";

type QueuedWebhook = {
  event: string;
  action: string | undefined;
  payload: any;
  status: string;
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
  enqueueWebhook(payload: any, event: string, action: string | undefined, baseUrl: string) {
    globalForQueue.webhookBuffer.push({
      event: event || "unknown",
      action: action,
      payload,
      status: "pending",
    });

    if (!globalForQueue.webhookFlushTimeout) {
      globalForQueue.webhookFlushTimeout = setTimeout(() => {
        this.flushWebhooks(baseUrl).catch(console.error);
      }, 500); // Batch after 500ms
    }
  }

  private async flushWebhooks(baseUrl: string) {
    const batch = globalForQueue.webhookBuffer.splice(0, globalForQueue.webhookBuffer.length);
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

    return { activeWorkers, pendingJobs, isThrottled: false };
  }
}

export const webhookQueue = new WebhookQueueService();
