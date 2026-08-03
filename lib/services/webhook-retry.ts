import prisma from "../prisma";
import { webhookQueueInstance } from "../queue/webhookQueue";

export class WebhookRetryService {
  /**
   * Requeues failed webhook events by resetting their DB status to "pending"
   * and re-adding them to the BullMQ queue.
   *
   * Previously this method only updated the database status to "pending"
   * without actually re-enqueuing to BullMQ.  Since the BullMQ worker
   * (`startWebhookWorkerLoop`) is a pure queue consumer that never polls
   * the database for "pending" events, recovered events were stuck forever.
   */
  async requeueFailedJobs(): Promise<number> {
    try {
      const MAX_RETRIES = 3;

      // Find jobs that failed and haven't exceeded retry count
      const eligibleJobs = await prisma.webhookEvent.findMany({
        where: {
          status: "failed",
          retryCount: { lt: MAX_RETRIES }
        }
      });

      if (eligibleJobs.length === 0) return 0;

      // Re-enqueue each job to BullMQ before updating the DB status.
      // BullMQ will store these as "waiting" jobs; the worker picks them up
      // immediately since the queue is not paused.
      await webhookQueueInstance.addBulk(
        eligibleJobs.map(job => ({
          name: "process-webhook",
          data: { eventId: job.id },
        }))
      );

      // Batch update DB status to "pending" so that in-flight workers that
      // may have just processed these events do not double-process them.
      // The BullMQ job is already in the queue and will be processed;
      // setting status=pending signals that the event is being retried.
      await prisma.webhookEvent.updateMany({
        where: {
          id: { in: eligibleJobs.map(job => job.id) }
        },
        data: {
          status: "pending",
          retryCount: { increment: 1 }
        }
      });

      console.log(`[WebhookRetry] Requeued ${eligibleJobs.length} failed jobs for retry.`);
      return eligibleJobs.length;
    } catch (error) {
      console.error("[WebhookRetry] Failed to requeue jobs:", error);
      return 0;
    }
  }
}

export const webhookRetryService = new WebhookRetryService();
