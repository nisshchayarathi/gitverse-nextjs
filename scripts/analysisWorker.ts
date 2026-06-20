import "dotenv/config";
import os from "os";
import { Worker, Job } from "bullmq";
import connection from "../lib/redis";
import prisma, { disconnectPrisma } from "../lib/prisma";
import { analysisJobService } from "../lib/services/analysisJobService";
import { repositoryService } from "../lib/services/repositoryService";
import { ANALYSIS_QUEUE_NAME } from "../lib/queue/analysisQueue";
import { WEBHOOK_QUEUE_NAME } from "../lib/queue/webhookQueue";
import { processWebhookJob } from "../lib/workers/webhookProcessor";

// Catch any rejections that slip through the promise-gap fixes above.
process.on("unhandledRejection", async (reason) => {
  console.error("FATAL unhandled rejection — worker will exit:", reason);
  await disconnectPrisma();
  process.exit(1);
});

function getWorkerId(): string {
  return (
    process.env.WORKER_ID ||
    `${os.hostname()}-${process.pid}-${Math.random().toString(16).slice(2)}`
  );
}

export async function startAnalysisWorkerLoop(opts?: {
  workerId?: string;
}) {
  const workerId = opts?.workerId || getWorkerId();
  console.log(`BullMQ analysis worker starting: ${workerId}`);

  const worker = new Worker(
    ANALYSIS_QUEUE_NAME,
    async (job: Job) => {
      const { jobId, userId } = job.data;
      console.log(`Processing job ${jobId} (attempt ${job.attemptsMade + 1})`);

      const dbJob = await analysisJobService.getJob({ jobId, userId });
      if (!dbJob) {
        throw new Error(`Job ${jobId} not found in DB for user ${userId}`);
      }

      let lastProgressWriteAt = 0;
      let lastProgressPercent: number | undefined;
      let lastProgressMessage: string | undefined;

      const writeProgress = async (update: {
        progressPercent?: number;
        progressMessage?: string;
        progressDetails?: unknown;
      }) => {
        const now = Date.now();

        const percentChanged =
          update.progressPercent != null &&
          update.progressPercent !== lastProgressPercent;
        const messageChanged =
          update.progressMessage != null &&
          update.progressMessage !== lastProgressMessage;

        // Debounce updates to DB if nothing changed
        if (!percentChanged && !messageChanged && now - lastProgressWriteAt < 1000) {
          return;
        }

        await analysisJobService.updateProgress({
          jobId,
          update,
        });

        // Also update BullMQ progress
        if (update.progressPercent != null) {
          await job.updateProgress(update.progressPercent);
        }

        lastProgressWriteAt = now;
        if (update.progressPercent != null)
          lastProgressPercent = update.progressPercent;
        if (update.progressMessage != null)
          lastProgressMessage = update.progressMessage;
      };

      try {
        await writeProgress({ progressPercent: 0, progressMessage: "Processing" });

        if (dbJob.type !== "repository_analysis" && dbJob.type !== "architecture_generation") {
          throw new Error(`Unsupported job type: ${dbJob.type}`);
        }

        const details = dbJob.progressDetails as any;
        const scope = details?.scope;

        if (dbJob.type === "repository_analysis") {
          await repositoryService.analyzeRepository(dbJob.repositoryId, dbJob.userId, {
            scope,
            onProgress: async (update) => {
              await writeProgress(update);
            },
          });
        } else {
          await writeProgress({ progressPercent: 100, progressMessage: "Architecture analysis complete" });
        }

        await analysisJobService.markDone({ jobId });
      } catch (err: any) {
        const message = err?.message ? String(err.message) : String(err);
        console.error(`Job ${jobId} failed:`, err);

        await analysisJobService.markFailed({
          jobId,
          error: message,
          attempts: job.attemptsMade + 1,
          maxAttempts: dbJob.maxAttempts,
        });
        
        throw err; // Re-throw to let BullMQ handle retry/failure logic
      }
    },
    {
      connection: connection as any,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "1", 10),
      name: workerId,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on("failed", (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
  });

  const webhookWorker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job: Job) => {
      const { eventId } = job.data;
      console.log(`Processing webhook job ${job.id} for event ${eventId} (attempt ${job.attemptsMade + 1})`);
      
      try {
        await processWebhookJob(eventId);
      } catch (err: any) {
        console.error(`Webhook job ${job.id} failed:`, err);
        throw err;
      }
    },
    {
      connection: connection as any,
      concurrency: parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || process.env.WORKER_CONCURRENCY || "2", 10),
      name: `webhook-${workerId}`,
    }
  );

  webhookWorker.on("completed", (job) => {
    console.log(`Webhook Job ${job.id} has completed!`);
  });

  webhookWorker.on("failed", (job, err) => {
    console.log(`Webhook Job ${job?.id} has failed with ${err.message}`);
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}, shutting down BullMQ workers...`);
    await worker.close();
    await webhookWorker.close();
    await connection.quit();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
  process.on("SIGHUP", () => void shutdown("SIGHUP"));
}

const isMain = typeof require !== "undefined" && (require as any).main === module;
if (isMain) {
  startAnalysisWorkerLoop().catch(async (e) => {
    console.error("Worker fatal error:", e);
    await disconnectPrisma();
    process.exit(1);
  });
}
