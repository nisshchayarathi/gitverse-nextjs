import { NextRequest, NextResponse } from "next/server";

import { requireAuth, isHttpError } from "@/lib/api-auth";
import { analysisJobService } from "@/lib/services/analysisJobService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.id;

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(jobId)) {
      return NextResponse.json(
        { error: "Invalid job ID format. Expected a UUID" },
        { status: 400 }
      );
    }

    const job = await analysisJobService.getJob({
      jobId,
      userId: user.userId,
    });

    if (!job) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const details = job.progressDetails as { retryAfter?: number; rateLimited?: boolean } | null;
    const retryAfter = details?.retryAfter ?? null;

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
        retryAfter,
        rateLimited: details?.rateLimited ?? false,
      },
    });
  } catch (error: any) {
    console.error("Get analysis job error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
