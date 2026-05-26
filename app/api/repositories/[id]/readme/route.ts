import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { apiError } from "@/lib/api-error";
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return apiError(400, "Invalid repository ID");
    }

    const repository = await repositoryService.fetchAndStoreReadme(
      id,
      user.userId,
    );

    return NextResponse.json({
      repository: {
        id: repository.id,
        readmePath: repository.readmePath,
        readmeText: repository.readmeText,
        readmeFetchedAt: repository.readmeFetchedAt,
      },
    });
  } catch (error: any) {
    console.error("Fetch README error:", sanitizeError(error));

    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 }
      );
    }

    if (isHttpError(error)) {
      return apiError(error.status, error.message);
    }

    if (error?.message === "Repository not found") {
      return apiError(404, error.message);
    }

    return apiError(500, "Failed to fetch README");
  }
}
