import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import { GitHubAppService } from "@/lib/services/githubAppService";
import { GitHubService } from "@/lib/services/githubService";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";
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

function noStoreResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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
    return noStoreResponse({ error: "Invalid signature" }, 401);
  }

  if (event !== "pull_request") {
    return noStoreResponse({ ok: true, ignored: true, event });
  }

  let payload: PullRequestWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return noStoreResponse({ error: "Invalid JSON" }, 400);
  }

  const action = payload.action;
  if (!shouldHandlePullRequestAction(action)) {
    return noStoreResponse({ ok: true, ignored: true, action });
  }

  // Ignore draft PRs until they become ready_for_review
  if (payload.pull_request?.draft && action !== "ready_for_review") {
    return noStoreResponse({ ok: true, ignored: true, reason: "draft" });
  }

  // Avoid replying to bots (including ourselves)
  if (payload.sender?.type === "Bot") {
    return noStoreResponse({ ok: true, ignored: true, reason: "bot" });
  }

  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number;
  const installationId = payload.installation?.id;

  if (!owner || !repo || !number || !installationId) {
    return noStoreResponse({ error: "Missing required fields" }, 400);
  }

  try {
    const repoFullName = `${owner}/${repo}`;

    // Gate by DB selection: only auto-review repos that users explicitly enabled.
    // Verify the installation belongs to a registered user to enforce ownership.
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
      return noStoreResponse({ ok: true, ignored: true, reason: "repo_not_enabled" });
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
      return noStoreResponse(
        { error: "Missing head SHA from GitHub PR response" },
        500
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
        return noStoreResponse({
          ok: true,
          ignored: true,
          reason: "already_reviewed",
        });
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

    return noStoreResponse({
      ok: true,
      posted: postedUrl,
      postError,
      stored: {
        pullRequestId: prRecord.id,
        prReviewId: reviewRow.id,
        headSha,
      },
    });
  } catch (error: any) {
    const safeError = isAxiosError(error)
      ? {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        }
      : error;
    console.error("GitHub webhook PR review error:", safeError);
    return NextResponse.json(
      {
        error: "Failed to process PR webhook",
        details: error?.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
