import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export async function GET(request: NextRequest) {
  try {
    // Basic admin check (could be expanded)
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ADMIN_DLQ);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { searchParams } = new URL(request.url);
    const take = Number(searchParams.get("take")) || 50;
    const skip = Number(searchParams.get("skip")) || 0;

    const [events, total] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: { status: "dlq" },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.webhookEvent.count({
        where: { status: "dlq" }
      })
    ]);

    return NextResponse.json({ events, total }, { status: 200 });
  } catch (error: any) {
    console.error("DLQ fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
