import { NextRequest, NextResponse } from "next/server";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import { getPoolHealth, getPoolConfig } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isInternalWorkerAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = getPoolHealth();

  return NextResponse.json({
    status: health.healthy ? "healthy" : "degraded",
    pool: health,
    config: getPoolConfig(),
    timestamp: new Date().toISOString(),
  });
}
