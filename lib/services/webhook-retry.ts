import prisma from "../prisma";

export class WebhookRetryService {
  /**
   * Resets eligible failed or stuck webhooks to "pending" state
   * so they can be picked up by the WebhookQueueService.
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

      // Batch update them back to pending
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
