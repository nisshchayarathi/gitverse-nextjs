import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  isAnalysisRunnerAuthorized,
  registerUnhandledRejectionLogger,
} from "@/lib/utils/analysisRunner";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";

const lastRunAtByIp = new Map<string, number>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = lastRunAtByIp.get(ip) ?? 0;
  if (now - last < 5000) return true;
  lastRunAtByIp.set(ip, now);
  return false;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && ip !== "unknown") return ip;
  }
  return request.headers.get("x-real-ip") || request.ip || "unknown";
}

async function runOnce(request: NextRequest): Promise<NextResponse> {
  registerUnhandledRejectionLogger();

  if (!isAnalysisRunnerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      { status: 429 },
    );
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

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

    await repositoryService.analyzeRepository(job.repositoryId, {
      onProgress: async (update) => {
        await analysisJobService.updateProgress({
          jobId: job.id,
          workerId,
          update,
        });
      },
    });

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
