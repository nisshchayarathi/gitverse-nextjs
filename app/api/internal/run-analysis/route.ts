import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  isAnalysisRunnerAuthorized,
  registerUnhandledRejectionLogger,
} from "@/lib/utils/analysisRunner";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";
import { isRateLimited } from "@/lib/services/rateLimitService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && ip !== "unknown") return ip;
  }
  return request.headers.get("x-real-ip") || request.ip || "unknown";
}

function logUnauthorizedAttempt(request: NextRequest, reason: string) {
  const ip = getClientIp(request);
  const url = request.url;
  const method = request.method;
  logger.warn(
    { ip, method, url, reason },
    "[AnalysisRunner] Unauthorized access attempt"
  );
}

async function runOnce(request: NextRequest): Promise<NextResponse> {
  registerUnhandledRejectionLogger();

  if (!process.env.ANALYSIS_RUNNER_SECRET) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "[AnalysisRunner] ANALYSIS_RUNNER_SECRET is not configured. " +
        "Requests will be rejected until it is set."
      );
      return NextResponse.json(
        {
          error: "Server misconfigured: ANALYSIS_RUNNER_SECRET not set",
          code: "SECRET_MISSING",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "ANALYSIS_RUNNER_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!isAnalysisRunnerAuthorized(request)) {
    logUnauthorizedAttempt(request, "invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (await isRateLimited(ip, "LOGIN", 5, 5 * 60 * 1000)) {
    logUnauthorizedAttempt(request, "rate limited");
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      { status: 429 },
    );
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

  await analysisJobService.reclaimOrphanedJobs();
  const job = await analysisJobService.claimNextJob({ workerId });
  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId,
      update: {
        progressPercent: job.progressPercent ?? 0,
        progressMessage: job.progressMessage ?? "Processing",
      },
    });

    if (job.type === "architecture_generation") {
      await repositoryService.generateArchitectureIteratively(job.repositoryId, job.userId, {
        onProgress: async (update) => {
          await analysisJobService.updateProgress({
            jobId: job.id,
            workerId,
            update,
          });
        },
      });
    } else {
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

    await analysisJobService.markDone({ jobId: job.id, workerId });

    return NextResponse.json({ ok: true, jobId: job.id, status: "DONE" });
  } catch (error: any) {
    const message = String(error?.message || error || "Unknown error");

    await analysisJobService.markFailed({
      jobId: job.id,
      workerId,
      error: message,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });

    const sanitizedMessage =
      process.env.NODE_ENV === "production"
        ? "Analysis failed"
        : message;

    return NextResponse.json(
      { ok: false, jobId: job.id, status: "FAILED", error: sanitizedMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return runOnce(request);
}
