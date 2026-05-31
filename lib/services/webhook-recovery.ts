import prisma from "../../lib/prisma";

export class WebhookRecoveryService {
  /**
   * Sweeps the database for webhooks stuck in 'processing' state.
   * Marks them as 'timed_out' if they exceed a certain threshold (e.g. 10 minutes).
   */
  public async recoverStuckWebhooks(timeoutMinutes = 10): Promise<number> {
    const thresholdDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    try {
      const result = await prisma.webhookEvent.updateMany({
        where: {
          status: 'processing',
          updatedAt: {
            lt: thresholdDate
          }
        },
        data: {
          status: 'timed_out',
          error: 'Event exceeded processing limits and was forcibly timed out.'
        }
      });
      return result.count;
    } catch (err) {
      console.error("[WebhookRecovery] Failed to recover stuck webhooks:", err);
      return 0;
    }
  }
}

export const webhookRecovery = new WebhookRecoveryService();
