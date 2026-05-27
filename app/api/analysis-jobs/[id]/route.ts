import { NextRequest, NextResponse } from "next/server";

import { requireAuth, isHttpError , sanitizeError } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";

const MAX_KICK_ENTRIES = 1000;
const lastKickAtByJobId = new Map<string, number>();


function kickLocalRunner(request: NextRequest, jobId: string) {
  if (process.env.NODE_ENV === "production") return;

  const now = Date.now();
  const lastKickAt = lastKickAtByJobId.get(jobId) ?? 0;


  if (now - lastKickAt < 5000) return;

  
  if (lastKickAtByJobId.size > MAX_KICK_ENTRIES) {
    const firstKey = lastKickAtByJobId.keys().next().value;
    lastKickAtByJobId.delete(firstKey);
  }


  if (now - lastKickAt < 5000) return; // throttle (best-effort)
  if (lastKickAtByJobId.size >= MAX_KICK_ENTRIES) {
  const firstKey = lastKickAtByJobId.keys().next().value;
  lastKickAtByJobId.delete(firstKey);
}

  lastKickAtByJobId.set(jobId, now);

  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;

  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: secret ? { "x-analysis-runner-secret": secret } : undefined,
  }).catch(() => {});
}


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.id;

    const job = await analysisJobService.getJob({
      jobId,
      userId: user.userId,
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "QUEUED") {
      kickLocalRunner(request, job.id);
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        type: job.type,
        repositoryId: job.repositoryId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        nextRunAt: job.nextRunAt,
        progressPercent: job.progressPercent,
        progressMessage: job.progressMessage,
        progressDetails: job.progressDetails,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        error: job.error,
        updatedAt: job.updatedAt,
        createdAt: job.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get analysis job error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to get analysis job" },
      { status: 500 }
    );
  }
}
