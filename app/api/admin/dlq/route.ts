import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";

export async function GET(request: NextRequest) {
  try {
    // Basic admin check (could be expanded)
    await requireAuth(request);

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
