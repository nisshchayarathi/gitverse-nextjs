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

export const runtime = "nodejs";

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

function shouldHandlePullRequestAction(action: string | undefined): boolean {
  return (
    action === "opened" ||
    action === "reopened" ||
    action === "synchronize" ||
    action === "ready_for_review"
  );
}

function shouldHandleIssueAction(action: string | undefined): boolean {
  return action === "opened";
}

export async function POST(request: NextRequest) {
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
    // Ignore draft PRs until they become ready_for_review
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
    // We accept all push events
  }

  // Avoid replying to bots (including ourselves)
  if (payload.sender?.type === "Bot") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "bot" },
      { status: 200 },
    );
  }

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

  // Store webhook event for async processing in-memory to prevent pool exhaustion
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    webhookQueue.enqueueWebhook(payload, event || "unknown", action, baseUrl);

    // Automatically retry any previously failed jobs occasionally
    webhookRetryService.requeueFailedJobs().catch(() => {});

    return NextResponse.json(
      { ok: true, message: "Webhook accepted and queued for processing" },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing webhook event:", error);
    return NextResponse.json(
      { error: "Failed to queue webhook event" },
      { status: 500 }
    );
  }
}
