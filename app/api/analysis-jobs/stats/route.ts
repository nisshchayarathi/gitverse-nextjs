import { NextRequest, NextResponse } from "next/server";

import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import { analysisJobService } from "@/lib/services/analysisJobService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const stats = await analysisJobService.getAnalysisStats({
      userId: user.userId,
    });

    return NextResponse.json({
      ok: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[api/analysis-jobs/stats] Failed to fetch stats:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch job statistics" },
      { status: 500 },
    );
  }
}
