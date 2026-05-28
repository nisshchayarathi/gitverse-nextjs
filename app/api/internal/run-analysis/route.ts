import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import {
  isAnalysisRunnerAuthorized,
  registerUnhandledRejectionLogger,
} from "@/lib/utils/analysisRunner";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 30_000;
const WORKER_TIMEOUT_MS = 55_000; // 55 seconds to respond before Vercel times out (usually 60s limit)

function log(level: "info" | "warn" | "error", message: string, context?: any) {
  logger[level]({ ...context }, message);
}

/**
 * Races `promise` against a hard deadline.
 * Rejects with a typed error so callers can distinguish timeout from other
 * failures and mark the job accordingly.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error(`Timed out after ${ms} ms`), {
          code: "WORKER_TIMEOUT",
        }),
      );
    }, ms);

    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function runOnce(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();
  registerUnhandledRejectionLogger();
  if (!isAnalysisRunnerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

  log("info", "Worker started", { workerId });

  // Claim job
  let job: Awaited<ReturnType<typeof analysisJobService.claimNextJob>>;
  try {
    job = await analysisJobService.claimNextJob({ workerId });
  } catch (err: any) {
    // Treat DB / service errors on claim as 503 so the cron retries
    log("error", "Failed to claim job", {
      workerId,
      error: err?.message ?? String(err),
    });
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  const job = await analysisJobService.claimNextJob({ workerId });
  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  log("info", "Job claimed", {
    workerId,
    jobId: job.id,
    repositoryId: job.repositoryId,
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  let isHeartbeatRunning = true;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  const abortController = new AbortController();

  // Initial progress update
  try {
    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId,
      update: {
        progressPercent: job.progressPercent ?? 0,
        progressMessage: job.progressMessage ?? "Processing",
      },
    });
  } catch (err: any) {
    log("warn", "Failed to send initial progress update", {
      workerId,
      jobId: job.id,
      error: err?.message ?? String(err),
    });
  }

  // Heartbeat Promise setup
  let heartbeatReject: (reason?: any) => void;
  const heartbeatPromise = new Promise((_, reject) => {
    heartbeatReject = reject;
  });

  const runHeartbeat = async () => {
    if (!isHeartbeatRunning) return;
    try {
      await analysisJobService.heartbeat({
        jobId: job!.id,
        workerId,
      });
      if (isHeartbeatRunning) {
        heartbeatTimer = setTimeout(runHeartbeat, HEARTBEAT_INTERVAL_MS);
      }
    } catch (e: any) {
      log("error", "Heartbeat failed", {
        workerId,
        jobId: job!.id,
        error: e?.message ?? String(e),
      });
      isHeartbeatRunning = false;
      const err = new Error("Heartbeat failed, losing job lock.");
      abortController.abort(err);
      heartbeatReject(err);
    }
  };

  // Start heartbeat
  heartbeatTimer = setTimeout(runHeartbeat, HEARTBEAT_INTERVAL_MS);

  try {
    // 1. Run analysis with hard Vercel timeout raced against heartbeat failure
    const analyzePromise = withTimeout(
      repositoryService.analyzeRepository(job.repositoryId, job.userId, {
        signal: abortController.signal,
        onProgress: async (update) => {
          try {
            await analysisJobService.updateProgress({
              jobId: job!.id,
              workerId,
              update,
            });
            log("info", "Progress update", {
              workerId,
              jobId: job!.id,
              ...update,
            });
          } catch (progressErr: any) {
            log("warn", "Progress update failed", {
              workerId,
              jobId: job!.id,
              error: progressErr?.message ?? String(progressErr),
            });
          }
        },
      }),
      WORKER_TIMEOUT_MS,
    );

    // Race both the analysis promise and the heartbeat failure promise
    await Promise.race([analyzePromise, heartbeatPromise]);

    // Clean up heartbeat
    isHeartbeatRunning = false;
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;

    await analysisJobService.markDone({ jobId: job.id, workerId });

    const durationMs = Date.now() - startMs;
    log("info", "Job completed successfully", {
      workerId,
      jobId: job.id,
      durationMs,
    });

    return NextResponse.json({ ok: true, jobId: job.id, status: "DONE" });
  } catch (error: any) {
    // Clean up heartbeat
    isHeartbeatRunning = false;
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;

    // Abort analysis to stop any in-flight work
    abortController.abort(error);

    const message = String(error?.message || error || "Unknown error");
    const isTimeout = error?.code === "WORKER_TIMEOUT";
    const safeMessage = isTimeout
      ? "Analysis timed out — will retry"
      : "Analysis failed";

    const durationMs = Date.now() - startMs;

    log("error", isTimeout ? "Job timed out" : "Job failed", {
      workerId,
      error: message,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      internalError: error?.message ?? String(error),
    });

    // Mark job failed
    try {
      await analysisJobService.markFailed({
        jobId: job.id,
        workerId,
        error: safeMessage,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
    } catch (markErr: any) {
      log("error", "Failed to mark job as failed", {
        workerId,
        jobId: job.id,
        error: markErr?.message ?? String(markErr),
      });
    }

    // Set repository status to failed
    try {
      await repositoryService.setRepositoryStatus(job.repositoryId, "failed");
      log("info", "Repository status set to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
      });
    } catch (repoErr: any) {
      log("error", "Failed to update repository status to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
        error: repoErr?.message ?? String(repoErr),
      });
    }

    return NextResponse.json(
      { ok: false, jobId: job.id, status: "FAILED", error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return runOnce(request);
}

export async function GET(request: NextRequest) {
  return runOnce(request);
}
