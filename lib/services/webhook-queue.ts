import prisma from "../prisma";
import { WebhookQueueStatus } from "../../types/database-health";
import { webhookQueueInstance } from "../queue/webhookQueue";

/**
 * WebhookQueueService
 *
 * Persists incoming webhook events to PostgreSQL and enqueues them
 * to BullMQ for asynchronous processing.  Every event is written to
 * the database before the HTTP response is sent, eliminating the data
 * loss that occurred with the previous in-memory buffer approach.
 *
 * ## Design decisions
 *
 * - **Direct DB write**: `enqueueWebhook()` calls `prisma.webhookEvent.create()`
 *   synchronously (within the request lifecycle).  The event is durable
 *   as soon as the create commits.
 *
 * - **BullMQ addBulk**: Even single events are enqueued via `addBulk()`,
 *   which is a single Redis round-trip.  This keeps the code consistent
 *   and avoids any future regression from a `for-await` loop when batch
 *   support is added.
 *
 * - **deliveryId deduplication**: For GitHub webhooks, the
 *   `X-GitHub-Delivery` header uniquely identifies a delivery attempt.
 *   Before creating a row, `findFirst` checks for an existing event with
 *   the same deliveryId.  This is a second defense behind the Redis
 *   idempotency lock in the route handler.
 *
 * - **No global mutable state**: The previous implementation used
 *   `globalThis.webhookBuffer` and a 500 ms `setTimeout` flush, which
 *   was incompatible with serverless termination.  This service holds
 *   no state between invocations.
 *
 * ## Event states
 *
 * | State         | Meaning                                           |
 * |---------------|---------------------------------------------------|
 * | pending       | Created, awaiting BullMQ worker pick-up           |
 * | processing    | Worker has dequeued the job                        |
 * | completed     | Worker finished successfully                       |
 * | failed        | All retry attempts exhausted                       |
 * | rate_limited  | Deferred due to upstream rate limit               |
 * | dlq           | Dead-letter (systemic failure, e.g. rate limiter)  |
 */
export class WebhookQueueService {
  /**
   * Persist a webhook event and schedule it for background processing.
   *
   * ## Flow
   *
   * 1. If a `deliveryId` is provided, check for an existing event with
   *    the same deliveryId.  If found, log a warning and return — the
   *    event is already queued.
   * 2. Create a `WebhookEvent` row in PostgreSQL via Prisma.
   * 3. Enqueue the event ID to BullMQ as a `process-webhook` job using
   *    `addBulk()`.
   *
   * ## Serverless safety
   *
   * All I/O (database write, Redis enqueue) completes before this
   * method returns, so the caller can send the HTTP response only
   * after durability is confirmed.  This guarantees no data loss even
   * if the Vercel function is terminated immediately after the response.
   *
   * @param payload  - Parsed webhook body (will be JSON-serialized by Prisma).
   * @param event    - Event type (e.g. "push", "pull_request", "issues").
   * @param action   - Optional sub-action (e.g. "opened", "synchronize").
   * @param baseUrl  - Base URL for internal callbacks (unused in current flow).
   * @param deliveryId - X-GitHub-Delivery header value for deduplication.
   */
  async enqueueWebhook(
    payload: any,
    event: string,
    action: string | undefined,
    baseUrl: string,
    deliveryId?: string,
  ) {
    if (deliveryId) {
      const existing = await prisma.webhookEvent.findFirst({
        where: { deliveryId },
      });
      if (existing) {
        console.log(`[WebhookQueue] Duplicate deliveryId ${deliveryId}, skipping`);
        return;
      }
    }

    const created = await prisma.webhookEvent.create({
      data: {
        event: event || "unknown",
        action,
        payload,
        status: "pending",
        deliveryId,
      },
      select: { id: true },
    });

    await webhookQueueInstance.addBulk([
      { name: "process-webhook", data: { eventId: created.id } },
    ]);
  }

  /**
   * Return queue metrics for monitoring dashboards and health checks.
   *
   * Counts events in `processing` and `pending` status.  Throttling is
   * handled by BullMQ's worker concurrency settings, so `isThrottled`
   * always returns `false`.
   *
   * @deprecated triggerWorkers is kept for backward compatibility but the
   *   throttling logic now lives in BullMQ worker configuration.  Use
   *   BullMQ's `getJobs()` or `getJobCounts()` for richer metrics.
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
