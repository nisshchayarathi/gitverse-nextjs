import { NextRequest, NextResponse } from "next/server";
import { recoverStuckEvents } from "@/lib/services/webhookRecoveryService";
import { isCronAuthorized } from "@/lib/utils/internalAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recoverStuckEvents();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/webhook-recovery] Recovery failed:", error);
    return NextResponse.json(
      { error: "Recovery failed", details: error?.message },
      { status: 500 }
    );
  }
}
