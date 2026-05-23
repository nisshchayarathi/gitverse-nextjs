import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { repositoryService } from "@/lib/services/repositoryService";

// Helper object containing secure caching headers to prevent data leakage
const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
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
  } catch (error: any) {
    console.error("Get repository error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    await repositoryService.deleteRepository(id, user.userId);

    // Added securityHeaders here as well
    return NextResponse.json(
      { message: "Repository deleted successfully" },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Delete repository error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    if (error.message === "Repository not found") {
      return NextResponse.json(
        { error: error.message }, 
        { status: 404, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500, headers: securityHeaders }
    );
  }
}