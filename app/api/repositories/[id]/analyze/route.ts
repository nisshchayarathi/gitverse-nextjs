import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import prisma from "@/lib/prisma";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";

async function kickLocalRunner(request: NextRequest): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
  
  // Trigger local analysis runner; caller decides whether to await this dispatch.
  const response = await fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: secret ? { "x-analysis-runner-secret": secret } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Local analysis runner failed: ${response.statusText}`);
  }
}

async function kickProductionWorker(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await triggerAnalysisWorkerWorkflow();
}
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const existingJob = await prisma.analysisJob.findFirst({
  where: {
    repositoryId: id,
    status: {
      in: ["QUEUED", "PROCESSING"],
    },
  },
});

if (existingJob) {
  return NextResponse.json(
    {
      error: "Analysis already in progress",
      jobId: existingJob.id,
    },
    { status: 409 }
  );
}

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: id,
      userId: user.userId,
    });

    try {
      if (process.env.NODE_ENV === "production") {
        await kickProductionWorker();
      } else {
        // In dev, we don't want to block the 202 response for the entire analysis.
        // We catch fetch failures and update the job to FAILED if it couldn't start.
        void kickLocalRunner(request).catch((err) => {
          console.error("Local runner dispatch failed:", sanitizeError(err));
          void prisma.analysisJob
            .updateMany({
              where: { id: job.id, status: "QUEUED" },
              data: { status: "FAILED", error: "Failed to dispatch local runner" },
            })
            .catch((updateErr) => {
              console.error(
                "Failed to persist local dispatch failure:",
                sanitizeError(updateErr),
              );
            });
        });
      }
    } catch (dispatchError: any) {
      // If production dispatch fails, fail the job and return error.
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: "Failed to dispatch analysis worker" }
      });
      return NextResponse.json(
        { error: "Failed to dispatch analysis worker" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { message: "Job queued", jobId: job.id, status: job.status },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Analyze repository error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}
