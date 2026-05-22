import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400 }
      );
    }

    const user = await requireAuth(request);

    // Verify ownership
    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: id,
      userId: user.userId,
    });

    return NextResponse.json(
      { message: "Job queued", jobId: job.id, status: job.status },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Analyze repository error:", error);
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
