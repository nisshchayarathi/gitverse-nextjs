import { NextRequest, NextResponse } from "next/server";
import { requireAuth , sanitizeError } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";
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
