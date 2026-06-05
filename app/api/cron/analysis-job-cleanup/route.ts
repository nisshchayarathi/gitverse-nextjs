import { NextRequest, NextResponse } from "next/server";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { isCronAuthorized } from "@/lib/utils/internalAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Cleanup is now handled internally by BullMQ (dead worker detection, retries).
    return NextResponse.json({
      ok: true,
      message: "Background job lifecycle is now managed by BullMQ",
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
