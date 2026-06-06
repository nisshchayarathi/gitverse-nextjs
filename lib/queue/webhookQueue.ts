import { Queue } from "bullmq";
import connection from "../redis";

export const WEBHOOK_QUEUE_NAME = "webhook-events";

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

// Alias for backwards compatibility with webhook-queue service
export const webhookQueueInstance = webhookQueue;
