import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import { GithubWebhookVerifier } from "@/lib/services/githubWebhookVerifier";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getClientIp } from "@/lib/services/rateLimitService";
import { SafeHttpClient } from "@/services/security/safe-http-client";
import { webhookQueue } from "@/lib/services/webhook-queue";
import { dbHealthService } from "@/lib/services/db-health";
import { webhookRetryService } from "@/lib/services/webhook-retry";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import { generateWebhookKey, tryAcquireIdempotency, releaseIdempotency } from "@/lib/utils/idempotency";

export const runtime = "nodejs";

/**
 * Shape of the parsed GitHub webhook payload.
 * Only the fields relevant to routing and downstream processing are declared.
 */
type WebhookPayload = {
  action?: string;
  installation?: { id?: number };
  repository?: {
    name?: string;
    owner?: { login?: string };
  };
  pull_request?: {
    number?: number;
    html_url?: string;
    draft?: boolean;
  };
  issue?: {
    number?: number;
    title?: string;
    body?: string;
    html_url?: string;
  };
  sender?: {
    type?: string;
    login?: string;
  };
};

/**
 * We only process PR events that materially change the diff or state:
 * - opened: new PR submitted
 * - reopened: closed PR brought back
 * - synchronize: new commits pushed to the branch
 * - ready_for_review: draft PR transitioned to non-draft
 */
function shouldHandlePullRequestAction(action: string | undefined): boolean {
  return (
    action === "opened" ||
    action === "reopened" ||
    action === "synchronize" ||
    action === "ready_for_review"
  );
}

/**
 * For issues, only process newly opened ones.
 * Comments, edits, and closures are ignored by this pipeline.
 */
function shouldHandleIssueAction(action: string | undefined): boolean {
  return action === "opened";
}

export async function POST(request: NextRequest) {
  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 1. Rate limiting                                          │
   * │    Apply per-IP rate limits before any I/O or parsing.    │
   * └──────────────────────────────────────────────────────────┘
   */
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.GITHUB_WEBHOOK);

  const rawBody = await request.text();

  if (rl.fallbackFailed) {
    console.error("[WebhookRoute] Rate limiters completely failed. DLQing webhook.");
    try {
      await prisma.webhookEvent.create({
        data: {
          event: request.headers.get("x-github-event") || "unknown",
          payload: rawBody,
          status: "dlq",
          error: "Rate limiter and fallback completely failed",
        },
      });
    } catch (e) {
      console.error("[WebhookRoute] Failed to write to DLQ!", e);
    }
    return NextResponse.json({ ok: true, message: "Webhook accepted and queued to DLQ due to severe outages" }, { status: 202 });
  }

  if (!rl.allowed) return rateLimitResponse(rl, "Webhook rate limit exceeded");

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 2. Signature verification                                 │
   * │    Validate the HMAC-SHA256 signature using the shared    │
   * │    webhook secret.  Two verifiers are tried: the newer    │
   * │    GithubWebhookVerifier service, then the legacy util.   │
   * └──────────────────────────────────────────────────────────┘
   */
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

  const isValid = await GithubWebhookVerifier.verifySignature(request, rawBody) || verifyGitHubWebhookSignature({
    rawBody,
    signature256Header: signature,
    webhookSecret: secret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 3. Event routing — only process events we handle         │
   * │    Unsupported event types (label, milestone, etc.) and   │
   * │    non-material PR/issue actions get a silent 200.        │
   * └──────────────────────────────────────────────────────────┘
   */
  const deliveryId = request.headers.get("x-github-delivery") || "";

  if (event !== "pull_request" && event !== "issues" && event !== "push") {
    return NextResponse.json(
      { ok: true, ignored: true, event },
      { status: 200 },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = payload.action;
  
  if (event === "pull_request") {
    if (!shouldHandlePullRequestAction(action)) {
      return NextResponse.json(
        { ok: true, ignored: true, action },
        { status: 200 },
      );
    }
    if (payload.pull_request?.draft && action !== "ready_for_review") {
      return NextResponse.json(
        { ok: true, ignored: true, reason: "draft" },
        { status: 200 },
      );
    }
  } else if (event === "issues") {
    if (!shouldHandleIssueAction(action)) {
      return NextResponse.json(
        { ok: true, ignored: true, action },
        { status: 200 },
      );
    }
  } else if (event === "push") {
    // We accept all push events — no action filtering needed
  }

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 4. Bot filtering                                          │
   * │    Ignore events sent by GitHub bots (including our own   │
   * │    automation) to prevent feedback loops.                 │
   * └──────────────────────────────────────────────────────────┘
   */
  if (payload.sender?.type === "Bot") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "bot" },
      { status: 200 },
    );
  }

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 5. Field validation                                       │
   * │    Ensure the payload contains the minimum required       │
   * │    fields before proceeding to idempotency and enqueue.   │
   * └──────────────────────────────────────────────────────────┘
   */
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number || payload.issue?.number;
  const installationId = payload.installation?.id;

  if (!owner || !repo || (!number && event !== "push") || !installationId) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        details: { owner, repo, number, installationId, event },
      },
      { status: 400 },
    );
  }

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 6. Redis-based idempotency                                │
   * │    Atomically claim the deliveryId so concurrent          │
   * │    deliveries of the same webhook are deduplicated.       │
   * │    The lock is released if the enqueue fails.             │
   * └──────────────────────────────────────────────────────────┘
   */
  let idempotencyKey: string | null = null;
  if (deliveryId) {
    idempotencyKey = generateWebhookKey(deliveryId, event || "unknown", action);
    const acquired = await tryAcquireIdempotency(idempotencyKey);
    if (!acquired) {
      return NextResponse.json(
        { ok: true, ignored: true, reason: "duplicate_delivery" },
        { status: 200 },
      );
    }
  }

  /*
   * ┌──────────────────────────────────────────────────────────┐
   * │ 7. Persist and enqueue                                    │
   * │    Write the event to PostgreSQL via WebhookQueueService, │
   * │    which also enqueues it to BullMQ.  The DB write is     │
   * │    synchronous within the request — no in-memory buffer.  │
   * │    Previously this used a global buffer + setTimeout that │
   * │    was lost on serverless termination (issue #1962).      │
   * └──────────────────────────────────────────────────────────┘
   */
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    await webhookQueue.enqueueWebhook(payload, event || "unknown", action, baseUrl, deliveryId);

    webhookRetryService.requeueFailedJobs().catch(() => {});

    return NextResponse.json(
      { ok: true, message: "Webhook accepted and queued for processing" },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing webhook event:", error);
    if (idempotencyKey) {
      await releaseIdempotency(idempotencyKey);
    }
    return NextResponse.json(
      { error: "Failed to queue webhook event" },
      { status: 500 }
    );
  }
}
