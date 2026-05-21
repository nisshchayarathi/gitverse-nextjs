import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import { GitHubAppService } from "@/lib/services/githubAppService";
import { GitHubService } from "@/lib/services/githubService";
import prisma from "@/lib/prisma";
import {
  formatPRReviewMarkdown,
  reviewPullRequest,
} from "@/lib/services/prReviewService";
import { isAxiosError } from "axios";

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

  try {
    const repoFullName = `${owner}/${repo}`;

    // Gate by DB selection: only auto-review repos that users explicitly enabled.
    // Hackathon scope: if *any* user enabled this repo, we process and attach the PR to that GitHubRepo row.
    const enabledRepo = await prisma.gitHubRepo.findFirst({
      where: {
        repoFullName,
        enabled: true,
        OR: [
          { installationId: BigInt(installationId) },
          { installationId: null },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    if (!enabledRepo) {
      return NextResponse.json(
        { ok: true, ignored: true, reason: "repo_not_enabled", repoFullName },
        { status: 200 },
      );
    }

    // Backfill installationId for future lookups.
    await prisma.gitHubRepo.updateMany({
      where: {
        repoFullName,
        enabled: true,
        installationId: null,
      },
      data: { installationId: BigInt(installationId) },
    });

    const app = new GitHubAppService();
    const installationToken =
      await app.getInstallationAccessToken(installationId);

    const github = new GitHubService(installationToken);
    const pr = await github.getPullRequest(owner, repo, number);
    const headSha = pr?.head?.sha;
    if (!headSha) {
      return NextResponse.json(
        {
          error: "Missing head SHA from GitHub PR response",
          details: { owner, repo, number },
        },
        { status: 500 },
      );
    }

    // Upsert PR record.
    const prRecord = await prisma.pullRequest.upsert({
      where: {
        repoId_prNumber: {
          repoId: enabledRepo.id,
          prNumber: number,
        },
      },
      create: {
        repoId: enabledRepo.id,
        prNumber: number,
        title: pr.title,
        author: pr.user?.login || "unknown",
        headSha,
        htmlUrl: pr.html_url,
        status: "OPEN",
      },
      update: {
        title: pr.title,
        author: pr.user?.login || "unknown",
        headSha,
        htmlUrl: pr.html_url,
        status: "OPEN",
      },
    });

    // Dedupe/lock: create a placeholder review row keyed by (pullRequestId, headSha).
    // If another delivery is already processing/processed this SHA, we skip posting a duplicate comment.
    let reviewRow: {
      id: number;
      pullRequestId: number;
      headSha: string;
    } | null = null;
    try {
      reviewRow = await prisma.pRReview.create({
        data: {
          pullRequestId: prRecord.id,
          headSha,
          reviewText: "(processing)",
          rawJson: {},
        },
        select: { id: true, pullRequestId: true, headSha: true },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json(
          {
            ok: true,
            ignored: true,
            reason: "already_reviewed",
            repoFullName,
            prNumber: number,
            headSha,
          },
          { status: 200 },
        );
      }
      throw e;
    }

    const { review, prUrl } = await reviewPullRequest({
      owner,
      repo,
      number,
      githubToken: installationToken,
    });

    const comment = formatPRReviewMarkdown({ review, prUrl });
    let postedUrl: string | null = null;
    let postError: {
      status?: number;
      message?: string;
      documentation_url?: string;
      url?: string;
    } | null = null;

    try {
      const posted = await github.postPullRequestComment(
        owner,
        repo,
        number,
        comment,
      );
      postedUrl = posted?.html_url || null;
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data as any;
        // For GitHub Apps, 403 "Resource not accessible by integration" is common when the app
        // lacks access to write comments/reviews in a particular repo/PR. Don't fail the webhook.
        if (status === 403) {
          postError = {
            status,
            message: String(data?.message || err.message || "Forbidden"),
            documentation_url: data?.documentation_url,
            url: err.config?.url,
          };
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    await prisma.pRReview.update({
      where: { id: reviewRow.id },
      data: {
        reviewText: comment,
        rawJson: {
          ...(review as any),
          _githubPost: {
            ok: Boolean(postedUrl),
            postedUrl,
            error: postError,
          },
        } as any,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        posted: postedUrl,
        postError,
        stored: {
          pullRequestId: prRecord.id,
          prReviewId: reviewRow.id,
          headSha,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GitHub webhook PR review error:", error);
    return NextResponse.json(
      {
        error: "Failed to process PR webhook",
      },
      { status: 500 },
    );
  }
}
