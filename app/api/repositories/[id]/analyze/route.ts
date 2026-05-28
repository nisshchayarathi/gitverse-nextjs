import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { apiError } from "@/lib/api-error";
import { isValidGitScope } from "@/lib/utils/validators";

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

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return apiError(404, "Repository not found");
    }

    const { scope } = await request.json();

    if (scope != null && (typeof scope !== "string" || !isValidGitScope(scope))) {
      return apiError(400, "Invalid scope. Only alphanumeric characters, underscore, dot, slash, and hyphen are allowed.");
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
