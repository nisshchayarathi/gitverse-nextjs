import { NextRequest, NextResponse } from "next/server";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { isCronAuthorized } from "@/lib/utils/internalAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [reclaimed, failed] = await Promise.all([
      analysisJobService.reclaimOrphanedJobs(),
      analysisJobService.cleanupStaleJobs(),
    ]);

    return NextResponse.json({
      ok: true,
      reclaimed,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/analysis-job-cleanup] Cleanup failed:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error?.message },
      { status: 500 }
    );
  }
}
