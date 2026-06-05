import { Queue } from "bullmq";
import connection from "../redis";

export const ANALYSIS_QUEUE_NAME = "analysis-jobs";

export const analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
