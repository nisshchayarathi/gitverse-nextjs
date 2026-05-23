import { NextRequest, NextResponse } from "next/server";
import { requireAuth , sanitizeError } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const user = await requireAuth(request);

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const job = await analysisJobService.getJob({ jobId, userId: user.userId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("GET /analysis/:jobId error:", sanitizeError(error));
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
