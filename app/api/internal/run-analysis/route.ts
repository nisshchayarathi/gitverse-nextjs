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

  // Fail-closed: if no secret is configured in production, deny all requests.
  // An unset secret must never silently open access in any deployed environment.
  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[run-analysis] ANALYSIS_RUNNER_SECRET is not set. " +
          "All requests are rejected in production until the secret is configured."
      );
      return false;
    }
    // Allow unauthenticated calls only in local development.
    return true;
  }

  // Secret is configured -- verify it on every request, regardless of HTTP method.
  // Vercel Cron sends plain GET requests; the recommended approach is to set
  // CRON_SECRET equal to ANALYSIS_RUNNER_SECRET so Vercel automatically
  // injects "Authorization: Bearer <CRON_SECRET>" on each cron invocation.
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${configuredSecret}`) return true;

  // Also accept the value in the custom header for non-cron callers
  // (e.g. a GitHub Actions workflow or an internal service).
const HEARTBEAT_INTERVAL_MS = 30_000;

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET;

  // When no secret is configured, allow in dev or via Vercel Cron on Vercel.
  if (!configuredSecret) {
    if (process.env.NODE_ENV !== "production") return true;

    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    if (
      request.method === "GET" &&
      process.env.VERCEL === "1" &&
      process.env.VERCEL_ENV === "production" &&
      ua.includes("vercel-cron/")
    ) {
      return true;
    }

    return false;
  }

  // When a secret is configured, always require it, regardless of
  // HTTP method or User-Agent. Vercel Cron jobs should include the
  // secret as a query parameter in the cron path.
  const headerSecret = request.headers.get("x-analysis-runner-secret");
  if (headerSecret === configuredSecret) return true;

  return false;
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
