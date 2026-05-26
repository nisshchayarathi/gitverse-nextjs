import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.jobId;

    if (!jobId) {
      return apiError(400, "Missing jobId");
    }

    const job = await analysisJobService.getJob({ jobId, userId: user.userId });

    if (!job) {
      return apiError(404, "Job not found");
    }

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("GET /analysis/:jobId error:", error);
return apiError(500, "Failed to fetch job");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.jobId;

    if (!jobId) {
      return apiError(400, "Missing jobId");
    }

    const job = await prisma.analysisJob.findFirst({
      where: {
        id: jobId,
        userId: user.userId,
      },
    });

    if (!job) {
      return apiError(404, "Job not found");
    }

    if (
      job.status === "DONE" ||
      job.status === "FAILED" 
    ) {
      return apiError(400, "Job cannot be cancelled");
    }

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        progressMessage: "Cancelled by user",
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Job cancelled successfully",
    });
  } catch (error: any) {
    console.error("Cancel analysis job error:", error);
    return apiError(500, "Failed to cancel job");
  }
}