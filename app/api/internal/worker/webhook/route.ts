import { NextRequest, NextResponse } from "next/server";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import { webhookQueue } from "@/lib/queue/webhookQueue";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isAuthorized = isInternalWorkerAuthorized(authHeader);

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "You do not have permission to access this internal webhook endpoint.",
        code: "AUTH_FAILED"
      },
      { status: 401 }
    );
  }

  const rl = await checkRateLimit("webhook-worker", RATE_LIMITS.WORKER_WEBHOOK);
  if (!rl.allowed) return rateLimitResponse(rl, "Worker rate limit exceeded");

  try {
    const { eventId } = await request.json().catch(() => ({}));

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    await webhookQueue.add("webhook_event", { eventId }, {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    return NextResponse.json(
      { ok: true, message: "Webhook event enqueued for distributed processing" },
      { status: 202 }
    );
  } catch (error) {
    console.error("[WorkerWebhookRoute] Failed to enqueue webhook event:", error);
    return NextResponse.json(
      { error: "Failed to enqueue webhook event" },
      { status: 500 }
    );
  }
}
