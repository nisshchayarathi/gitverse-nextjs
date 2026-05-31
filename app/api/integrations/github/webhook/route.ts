import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { QuotaService } from "@/lib/services/quotaService";
import { getClientIp } from "@/lib/services/rateLimitService";
import { webhookQueue } from "@/lib/services/webhook-queue";
import { dbHealthService } from "@/lib/services/db-health";
import { webhookRetryService } from "@/lib/services/webhook-retry";


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
  // 1. IP-based Rate Limiter (60 requests per minute per IP)
  const clientIp = getClientIp(request);
  const isIpAllowed = await QuotaService.checkWebhookRateLimit(`webhook_ip_${clientIp}`, 60, 60000);
  if (!isIpAllowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

  if (
    !verifyGitHubWebhookSignature({
      rawBody,
      signature256Header: signature,
      webhookSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "pull_request" && event !== "issues") {
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

  if (!owner || !repo || !number || !installationId) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        details: { owner, repo, number, installationId },
      },
      { status: 400 },
    );
  }

  // 2. Installation-based Rate Limiter (30 requests per minute per installation)
  const isInstAllowed = await QuotaService.checkWebhookRateLimit(`webhook_inst_${installationId}`, 30, 60000);
  if (!isInstAllowed) {
    return NextResponse.json({ error: "Too Many Requests for Installation" }, { status: 429 });
  }

  // Store webhook event for async processing
  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        event: event || "unknown",
        action: action,
        payload: payload as any,
        status: "pending",
      },
    });

    // Automatically retry any previously failed jobs occasionally
    // (This is lightweight and ensures dead-letter recovery without a cron)
    webhookRetryService.requeueFailedJobs().catch(() => {});

    // Trigger internal workers asynchronously via queue manager
    const baseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    webhookQueue.triggerWorkers(baseUrl).catch(err => {
      console.error("[Webhook] Failed to trigger queue workers:", err);
    });

    return NextResponse.json(
      { ok: true, message: "Webhook accepted for processing", eventId: webhookEvent.id },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error persisting webhook event:", error);
    return NextResponse.json(
      { error: "Failed to persist webhook event" },
      { status: 500 }
    );
  }
}
