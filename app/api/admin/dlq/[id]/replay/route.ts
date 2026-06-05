import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin(request);
    const rl = await checkRateLimit("admin", RATE_LIMITS.ADMIN_DLQ_REPLAY);
    if (!rl.allowed) return rateLimitResponse(rl);

    const eventId = params.id;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "dlq") {
      return NextResponse.json({ error: "Event is not in DLQ" }, { status: 400 });
    }

    const updated = await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        error: null
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "REPLAY_DLQ_EVENT",
        resource: `admin/dlq/${eventId}/replay`,
        details: { eventId, originalStatus: event.status },
      }
    });

    return NextResponse.json({ success: true, event: updated }, { status: 200 });
  } catch (error: any) {
    console.error("DLQ replay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
