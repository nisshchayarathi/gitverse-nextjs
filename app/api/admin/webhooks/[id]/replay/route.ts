import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware";
import { webhookQueue } from "@/lib/queue/webhookQueue";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAdmin(_request);

    const event = await prisma.webhookEvent.findUnique({ where: { id: params.id } });
    if (!event) {
      return NextResponse.json({ error: "Webhook event not found" }, { status: 404 });
    }

    if (event.status !== "failed" && event.status !== "dlq" && event.status !== "rate_limited") {
      return NextResponse.json(
        { error: `Cannot replay event with status "${event.status}"` },
        { status: 400 },
      );
    }

    await prisma.webhookEvent.update({
      where: { id: params.id },
      data: { status: "pending", error: null, retryCount: 0, nextRetryAt: null },
    });

    await webhookQueue.add("process-webhook", { eventId: params.id });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "REPLAY_WEBHOOK",
        resource: `admin/webhooks/${params.id}/replay`,
        details: { eventId: params.id, previousStatus: event.status },
      },
    });

    return NextResponse.json({ ok: true, eventId: params.id });
  } catch (error: any) {
    console.error("Webhook replay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
