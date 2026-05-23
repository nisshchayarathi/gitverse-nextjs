import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { repositoryService } from "@/lib/services/repositoryService";

// Helper object containing secure caching headers to prevent data leakage
const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400, headers: securityHeaders }
      );
    }

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    const latestJob = await prisma.analysisJob.findFirst({
      where: { repositoryId: id, userId: user.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        type: true,
        attempts: true,
        maxAttempts: true,
        nextRunAt: true,
        progressPercent: true,
        progressMessage: true,
        startedAt: true,
        finishedAt: true,
        error: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // Added securityHeaders here so user data is never cached by browsers
    return NextResponse.json(
      { repository, latestJob },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: unknown) {
    console.error("Get repository error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: getErrorMessage(error, "Request failed") },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to get repository" },
      { status: 500, headers: securityHeaders }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID. Must be a positive integer." },
        { status: 400, headers: securityHeaders }
      );
    }

    await repositoryService.deleteRepository(id, user.userId);

    // Added securityHeaders here as well
    return NextResponse.json(
      { message: "Repository deleted successfully" },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: unknown) {
    console.error("Delete repository error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: getErrorMessage(error, "Request failed") },
        { status: error.status, headers: securityHeaders }
      );
    }

    const errorMessage = getErrorMessage(error, "");

    if (errorMessage === "Repository not found") {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500, headers: securityHeaders }
    );
  }
}
