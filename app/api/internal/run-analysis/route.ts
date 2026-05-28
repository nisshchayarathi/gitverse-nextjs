import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  isAnalysisRunnerAuthorized,
  registerUnhandledRejectionLogger,
} from "@/lib/utils/analysisRunner";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";



// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

async function runOnce(request: NextRequest): Promise<NextResponse> {
  registerUnhandledRejectionLogger();
  if (!isAnalysisRunnerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

  log("info", "Worker started", { workerId, authReason: auth.reason });

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

  if (!job) {
    log("info", "No pending jobs", { workerId });
    return new NextResponse(null, { status: 204 });
  }

  let heartbeatTimer: NodeJS.Timeout | null = null;

  try {
    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId,
      update: {
        progressPercent: job.progressPercent ?? 0,
        progressMessage: job.progressMessage ?? "Starting analysis…",
      },
    });

    heartbeatTimer = setInterval(() => {
      analysisJobService
        .heartbeat({ jobId: job.id, workerId })
        .catch((e) => console.error("serverless heartbeat failed", e));
    }, HEARTBEAT_INTERVAL_MS);

    await repositoryService.analyzeRepository(job.repositoryId, job.userId, {
      onProgress: async (update) => {
        await analysisJobService.updateProgress({
          jobId: job.id,
          workerId,
          update,
        });
      },
    });
  }

  // Run analysis with a hard timeout so we always respond before Vercel cuts us off
  try {
    await withTimeout(
      repositoryService.analyzeRepository(job.repositoryId, {
        onProgress: async (update) => {
          try {
            await analysisJobService.updateProgress({
              jobId: job.id,
              workerId,
              update,
            });
            log("info", "Progress update", {
              workerId,
              jobId: job.id,
              ...update,
            });
          } catch (progressErr: any) {
            // Progress failures are non-fatal — log and keep going
            log("warn", "Progress update failed", {
              workerId,
              jobId: job.id,
              error: progressErr?.message ?? String(progressErr),
            });
          }
        },
      }),
      WORKER_TIMEOUT_MS,
    );

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    await analysisJobService.markDone({ jobId: job.id, workerId });

    return NextResponse.json({ ok: true, jobId: job.id, status: "DONE" });
  } catch (error: any) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    const message = String(error?.message || error || "Unknown error");

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: "DONE",
      durationMs,
    });
  } catch (error: any) {
    const isTimeout = error?.code === "WORKER_TIMEOUT";
    // Never expose internal error details to callers
    const safeMessage = isTimeout
      ? "Analysis timed out — will retry"
      : "Analysis failed";

    const durationMs = Date.now() - startMs;

    log("error", isTimeout ? "Job timed out" : "Job failed", {
      workerId,
      jobId: job.id,
      durationMs,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      // Internal detail stays server-side only
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
      // Best-effort — if this also fails, the job will be reclaimed after its
      // lock TTL expires (handled by the job service)
      log("error", "Failed to mark job as failed", {
        workerId,
        jobId: job.id,
        error: markErr?.message ?? String(markErr),
      });
    }

    // Issue #330 — ensure repo status is explicitly set to "failed" at the
    // runner layer, even if repositoryService's own catch block was bypassed
    // (e.g. Vercel timeout fires before repositoryService catch can run, or
    // the DB connection drops mid-analysis leaving status stuck on "analyzing").
    try {
      await repositoryService.setRepositoryStatus(job.repositoryId, "failed");
      log("info", "Repository status set to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
      });
    } catch (repoErr: any) {
      // Non-fatal at this point — log for alerting but don't mask the original error
      log("error", "Failed to update repository status to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
        error: repoErr?.message ?? String(repoErr),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        jobId: job.id,
        status: isTimeout ? "TIMEOUT" : "FAILED",
        error: safeMessage,
        durationMs,
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  return runOnce(request);
}

export async function GET(request: NextRequest) {
  return runOnce(request);
}