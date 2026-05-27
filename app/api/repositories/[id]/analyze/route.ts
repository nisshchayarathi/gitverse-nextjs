import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
<<<<<<< standardize-api-errors
import { apiError } from "@/lib/api-error";
=======
import prisma from "@/lib/prisma";

>>>>>>> main
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return apiError(400, "Invalid repository ID");
    }

    // Verify ownership
    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return apiError(404, "Repository not found");
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
     return apiError(error.status, error.message);
    }
    return apiError(500, "Failed to start analysis");
  }
}
