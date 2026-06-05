import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/utils/internalAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/rate-limit-cleanup] Cleanup failed:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error?.message },
      { status: 500 }
    );
  }
}
