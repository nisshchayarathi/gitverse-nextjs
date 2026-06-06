import { Queue } from "bullmq";
import connection from "../redis";

export const WEBHOOK_QUEUE_NAME = "webhook-events";

export const webhookQueueInstance = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false, // Acts as a DLQ by keeping failed jobs
  },
});
