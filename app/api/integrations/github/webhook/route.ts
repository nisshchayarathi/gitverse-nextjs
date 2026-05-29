import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

type PullRequestWebhookPayload = {
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

export async function POST(request: NextRequest) {
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

  if (event !== "pull_request") {
    return NextResponse.json(
      { ok: true, ignored: true, event },
      { status: 200 },
    );
  }

  let payload: PullRequestWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = payload.action;
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

  // Avoid replying to bots (including ourselves)
  if (payload.sender?.type === "Bot") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "bot" },
      { status: 200 },
    );
  }

  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number;
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

    // Trigger internal worker asynchronously
    const baseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    const workerUrl = `${baseUrl}/api/internal/worker/webhook`;
    
    // Generate auth token for internal worker
    const internalSecret = process.env.GITHUB_WEBHOOK_SECRET || process.env.JWT_SECRET || "";
    const internalToken = `Bearer ${crypto.createHash('sha256').update(internalSecret).digest('hex')}`;

    // Non-blocking fetch
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": internalToken,
      },
      body: JSON.stringify({ eventId: webhookEvent.id }),
    }).catch(err => {
      console.error("Failed to trigger webhook worker:", err);
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
