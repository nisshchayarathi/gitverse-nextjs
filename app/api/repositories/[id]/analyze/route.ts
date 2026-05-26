import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import prisma from "@/lib/prisma";

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

    const bodyText = await request.text();
    let scope: string | undefined = undefined;
    if (bodyText) {
      try {
        const json = JSON.parse(bodyText);
        if (json.scope && typeof json.scope === "string") {
          scope = json.scope;
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: id,
      userId: user.userId,
      scope,
    });

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
