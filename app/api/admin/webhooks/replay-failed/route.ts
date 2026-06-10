import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware";
import { webhookQueue } from "@/lib/queue/webhookQueue";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);

    const failed = await prisma.webhookEvent.findMany({
      where: { status: { in: ["failed", "dlq", "rate_limited"] } },
      select: { id: true },
    });

    if (failed.length === 0) {
      return NextResponse.json({ ok: true, replayed: 0, message: "No failed events to replay" });
    }

    const ids = failed.map((e) => e.id);

    await prisma.webhookEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: "pending", error: null, retryCount: 0, nextRetryAt: null },
    });

    for (const id of ids) {
      await webhookQueue.add("process-webhook", { eventId: id });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "REPLAY_ALL_FAILED_WEBHOOKS",
        resource: "admin/webhooks/replay-failed",
        details: { count: ids.length },
      },
    });

    return NextResponse.json({ ok: true, replayed: ids.length });
  } catch (error: any) {
    console.error("Bulk replay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
