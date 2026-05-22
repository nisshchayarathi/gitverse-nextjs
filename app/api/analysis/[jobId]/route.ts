import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { analysisJobService } from "@/lib/services/analysisJobService";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await requireAuth(request);
    const jobId = params.jobId;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(jobId)) {
      return NextResponse.json(
        { error: "Invalid job ID format. Expected a UUID" },
        { status: 400 }
      );
    }

    const job = await analysisJobService.getJob({ jobId, userId: user.userId });

    if (!job) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("GET /analysis/:jobId error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
