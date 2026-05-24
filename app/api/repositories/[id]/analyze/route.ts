import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import prisma from "@/lib/prisma";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
function kickLocalRunner(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;

  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;

  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: secret
      ? { "x-analysis-runner-secret": secret }
      : undefined,
  }).catch(() => {
    // Best-effort only.
  });
}

function kickProductionWorker() {
  if (process.env.NODE_ENV !== "production") return;

  void triggerAnalysisWorkerWorkflow().catch((error) => {
    console.error("Failed to dispatch analysis worker workflow:", error);
  });
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

    kickLocalRunner(request);
    kickProductionWorker();

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
