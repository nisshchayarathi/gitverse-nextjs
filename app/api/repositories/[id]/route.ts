import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError, getPrismaErrorResponse } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { repositoryService } from "@/lib/services/repositoryService";

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

    return NextResponse.json(repository, { headers: securityHeaders });
  } catch (error: any) {
    console.error("Error fetching repository:", sanitizeError(error));

    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      // Return 503 DATABASE_COLD_START response if applicable
      return prismaError;
    }

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    if (error?.code === "P2002" || error?.code === "P2025") {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch repository" },
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

    return NextResponse.json(
      { message: "Repository deleted successfully" },
      { headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Delete repository error:", sanitizeError(error));

    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      return prismaError;
    }

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    if (error.message === "Repository not found") {
      return NextResponse.json(
        { error: "Repository not found or you don't have permission to delete it" },
        { status: 403, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500, headers: securityHeaders }
    );
  }
}
