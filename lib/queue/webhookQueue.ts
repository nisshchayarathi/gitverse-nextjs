import { Queue } from "bullmq";
import connection from "../redis";

/**
 * The name of the BullMQ queue that holds webhook processing jobs.
 * Jobs are named "process-webhook" and carry `{ eventId: string }` as data.
 * The worker is defined in `scripts/webhookWorker.ts`.
 */
export const WEBHOOK_QUEUE_NAME = "webhook-events";

/**
 * BullMQ Queue instance for webhook event processing.
 *
 * Configuration notes:
 *
 * - **attempts: 5** — Each job is retried up to 5 times before being
 *   marked as failed.  This accounts for transient worker failures
 *   (connection drops, rate limits, temporary unavailability of the
 *   GitHub API).
 *
 * - **backoff: exponential, 5s** — Retries wait 5 s, then 10 s, then
 *   20 s, then 40 s.  This prevents stampeding the upstream services
 *   when they are under load or returning errors.
 *
 * - **removeOnComplete: true** — Completed jobs are removed from Redis
 *   immediately to conserve memory.  Job histories are available via
 *   the `webhook_events` database table.
 *
 * - **removeOnFail: false** — Failed jobs are retained in Redis for
 *   inspection via the BullMQ dashboard or the `getFailed()` API.  They
 *   must be manually cleaned up or re-queued.
 *
 * The connection uses the shared ioredis instance from `lib/redis.ts`,
 * which reads the `REDIS_URL` environment variable.
 */
export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Alias for backward compatibility with `lib/services/webhook-queue.ts`.
 *
 * The service imports `webhookQueueInstance` to call `.addBulk()`.
 * The unaliased `webhookQueue` export is used by the internal worker
 * route (`app/api/internal/worker/webhook/route.ts`) and the webhook
 * worker script (`scripts/webhookWorker.ts`).
 */
export const webhookQueueInstance = webhookQueue;
