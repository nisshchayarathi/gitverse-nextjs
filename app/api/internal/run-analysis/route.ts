import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";

// Global catch — prevents Node 15+ from crashing the request on an
// unhandled rejection that made it past the promise-gap fixes above.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in run-analysis route:", reason);
});

const HEARTBEAT_INTERVAL_MS = 30_000;

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET;

  // If a secret is configured, require it for non-GET requests.
  // (Vercel Cron triggers are GET-only and cannot send custom headers.)
  if (configuredSecret && request.method !== "GET") {
    const headerSecret = request.headers.get("x-analysis-runner-secret");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");

    return headerSecret === configuredSecret || querySecret === configuredSecret;
  }

  // Vercel Cron: triggers are plain HTTP GETs to your `path`.
  // Per Vercel docs, cron-triggered functions contain `vercel-cron/1.0` as the User-Agent.
  // Note: User-Agent can be spoofed, but this is the strongest option that works with
  // `vercel.json` crons (which don't support custom headers).
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const isVercelCron =
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "production" &&
    ua.includes("vercel-cron/");
  if (request.method === "GET" && isVercelCron) return true;

  // In dev, allow calling without a secret.
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-analysis-runner-secret");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  return headerSecret === configuredSecret || querySecret === configuredSecret;
}

async function runOnce(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

  const job = await analysisJobService.claimNextJob({ workerId });
  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  let heartbeatTimer: NodeJS.Timeout | null = null;

  try {
    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId,
      update: {
        progressPercent: job.progressPercent ?? 0,
        progressMessage: job.progressMessage ?? "Processing",
      },
    });

    heartbeatTimer = setInterval(() => {
      analysisJobService
        .heartbeat({ jobId: job.id, workerId })
        .catch((e) => console.error("serverless heartbeat failed", e));
    }, HEARTBEAT_INTERVAL_MS);

    await repositoryService.analyzeRepository(job.repositoryId, {
      onProgress: async (update) => {
        await analysisJobService.updateProgress({
          jobId: job.id,
          workerId,
          update,
        });
      },
    });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    await analysisJobService.markDone({ jobId: job.id, workerId });

    return NextResponse.json({ ok: true, jobId: job.id, status: "DONE" });
  } catch (error: any) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    const message = String(error?.message || error || "Unknown error");

    await analysisJobService.markFailed({
      jobId: job.id,
      workerId,
      error: message,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });

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
