import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { recoverStuckEvents } from "@/lib/services/webhookRecoveryService";

export const runtime = "nodejs";

function isCronAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET || process.env.ANALYSIS_RUNNER_SECRET;

  if (!secret) {
    return false;
  }

  // Vercel cron injects "Authorization: Bearer <CRON_SECRET>"
  const expectedToken = `Bearer ${secret}`;

  try {
    const a = Buffer.from(expectedToken);
    const b = Buffer.from(authHeader || "");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
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
