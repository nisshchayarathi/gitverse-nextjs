import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { apiError } from "@/lib/api-error";
import { GitHubRateLimitError } from "@/lib/services/githubService";
import prisma from "@/lib/prisma";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return apiError(400, "Invalid repository ID");
    }

    const { readmeText, readmePath } = await request.json();
    if (readmeText === undefined) {
      return apiError(400, "readmeText is required");
    }

    // Verify ownership
    const repository = await prisma.repository.findFirst({
      where: { id, userId: user.userId },
    });

    if (!repository) {
      return apiError(404, "Repository not found");
    }

    const updated = await prisma.repository.update({
      where: { id },
      data: {
        readmeText,
        readmePath: readmePath || repository.readmePath || "README.md",
        readmeFetchedAt: new Date(),
      },
    });

    return NextResponse.json({
      repository: {
        id: updated.id,
        readmePath: updated.readmePath,
        readmeText: updated.readmeText,
        readmeFetchedAt: updated.readmeFetchedAt,
      },
    });
  } catch (error: any) {
    console.error("Save README error:", sanitizeError(error));

    if (isHttpError(error)) {
      return apiError(error.status, error.message);
    }

    return apiError(500, "Failed to save README");
  }
}

