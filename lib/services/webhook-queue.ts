import prisma from "../prisma";
import { WebhookQueueStatus } from "../../types/database-health";
import { SafeHttpClient } from "@/services/security/safe-http-client";
import { deriveBearerToken } from "@/lib/utils/internalAuth";

const MAX_CONCURRENT_WEBHOOKS = 5;

export class WebhookQueueService {
  /**
   * Attempts to trigger pending webhooks up to the maximum concurrent capacity.
   * If the capacity is reached, it exits silently.
   */
  async triggerWorkers(baseUrl: string): Promise<WebhookQueueStatus> {
    try {
      const activeWorkers = await prisma.webhookEvent.count({
        where: { status: "processing" },
      });

      const pendingJobs = await prisma.webhookEvent.count({
        where: { status: "pending" },
      });

      if (activeWorkers >= MAX_CONCURRENT_WEBHOOKS) {
        console.log(`[WebhookQueue] Throttled. ${activeWorkers}/${MAX_CONCURRENT_WEBHOOKS} active workers. ${pendingJobs} jobs pending.`);
        return { activeWorkers, pendingJobs, isThrottled: true };
      }

      const availableCapacity = MAX_CONCURRENT_WEBHOOKS - activeWorkers;
      if (pendingJobs === 0 || availableCapacity <= 0) {
        return { activeWorkers, pendingJobs, isThrottled: false };
      }

      // ATOMIC RESERVATION: Fetch and reserve jobs in a single transaction
      // This prevents multiple dispatchers from claiming the same jobs
      const nextJobs = await prisma.$transaction(async (tx) => {
        const jobs = await tx.webhookEvent.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          take: availableCapacity,
        });

        if (jobs.length > 0) {
          // Atomically mark these jobs as being dispatched
          // We use a "reserved" status internally to prevent race conditions during dispatch
          const jobIds = jobs.map(j => j.id);
          await tx.webhookEvent.updateMany({
            where: { id: { in: jobIds } },
            data: { status: "processing" },  // Mark as processing immediately upon reservation
          });
        }

        return jobs;
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
            "Authorization": internalToken,
          },
          body: JSON.stringify({ eventId: job.id }),
          allowLocalhost: true, // Allow localhost since it is an internal route
        }).catch((err: any) => {
          console.error(`[WebhookQueue] Failed to trigger worker for job ${job.id}:`, err);
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
  }
}

export const webhookQueue = new WebhookQueueService();
