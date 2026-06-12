import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.ADMIN_DLQ);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("take")) || 50, 200);
    const skip = Number(searchParams.get("skip")) || 0;
    const status = searchParams.get("status");
    const event = searchParams.get("event");
    const includePayload = searchParams.get("payload") === "true";
    const id = searchParams.get("id");

    const where: Prisma.WebhookEventWhereInput = {};
    if (status) where.status = status;
    if (event) where.event = event;
    if (id) where.id = id;

    const select: Prisma.WebhookEventSelect = includePayload
      ? { id: true, event: true, action: true, payload: true, status: true, error: true, deliveryId: true, retryCount: true, maxRetries: true, nextRetryAt: true, createdAt: true, updatedAt: true }
      : { id: true, event: true, action: true, status: true, error: true, deliveryId: true, retryCount: true, maxRetries: true, nextRetryAt: true, createdAt: true, updatedAt: true };

    const [events, total] = await Promise.all([
      prisma.webhookEvent.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, select }),
      prisma.webhookEvent.count({ where }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "ACCESS_WEBHOOK_INSPECTOR",
        resource: "admin/webhooks",
        details: { take, skip, status, event, returnedCount: events.length },
      },
    });

    return NextResponse.json({ events, total, take, skip });
  } catch (error: any) {
    console.error("Webhook inspector fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
