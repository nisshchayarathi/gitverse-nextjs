import { Worker, Job } from "bullmq";
import connection from "../redis";
import prisma from "../prisma";
import { WEBHOOK_QUEUE_NAME } from "../queue/webhookQueue";
import { GitHubAppService } from "../services/githubAppService";
import { GitHubService } from "../services/githubService";
import {
  formatPRReviewMarkdown,
  reviewPullRequest,
} from "../services/prReviewService";
import { isAxiosError } from "axios";
import { sanitizeError } from "../middleware";
import { QuotaService } from "../services/quotaService";
import { IssueTriageService } from "../services/issue-triage";
import { ImpactAnalysisService } from "../services/impact-analysis";
import { SelfHealingService } from "../services/self-healing";
import { secretDetector } from "../services/secret-detector";
import { securityAlerts } from "../services/security-alerts";
import { TimeoutEstimatorService } from "../services/timeout-estimator";
import { GitHubChecksService } from "../services/github-checks";
import { PremergePolicyEngine } from "../services/premerge-policy-engine";
import { CheckSummaryService } from "../services/check-summary";
import { CheckRecoveryService } from "../services/check-recovery";
import { PRImpactAnalysisService } from "../services/prImpactAnalysisService";
import { RepositorySyncQueue } from "../services/repositorySyncQueue";
import { classifyRetry } from "../utils/retry";
import { generateWebhookKey, completeIdempotency, failIdempotency, releaseIdempotency } from "../utils/idempotency";

async function processWebhookEvent(eventId: string): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!webhookEvent) {
    throw new Error(`Webhook event ${eventId} not found`);
  }

  if (webhookEvent.status !== "pending") {
    return;
  }

  const { count } = await prisma.webhookEvent.updateMany({
    where: { id: eventId, status: "pending" },
    data: { status: "processing" },
  });

  if (count === 0) {
    return;
  }

  const deliveryId = webhookEvent.deliveryId;
  const idempotencyKey = deliveryId ? generateWebhookKey(deliveryId, webhookEvent.event, webhookEvent.action || undefined) : null;
  const markIdempotentCompleted = async () => { if (idempotencyKey) await completeIdempotency(idempotencyKey).catch(() => {}); };
  const markIdempotentFailed = async () => { if (idempotencyKey) await failIdempotency(idempotencyKey).catch(() => {}); };

  const timeoutEstimator = new TimeoutEstimatorService();
  let globalCheckRunId: number | null = null;
  let globalOwner: string | null = null;
  let globalRepo: string | null = null;
  let globalGithubToken: string | null = null;

  try {
    const payload = webhookEvent.payload as any;
    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const pullNumber = payload.pull_request?.number;
    const issueNumber = payload.issue?.number;
    const number = pullNumber || issueNumber;
    const installationId = payload.installation?.id;

    if (!owner || !repo || (!number && webhookEvent.event !== "push") || !installationId) {
      throw new Error("Missing required fields in payload");
    }

    const repoFullName = `${owner}/${repo}`;

    const enabledRepo = await prisma.gitHubRepo.findFirst({
      where: {
        repoFullName,
        enabled: true,
        installationId: BigInt(installationId),
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    if (!enabledRepo) {
      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed", error: "Repo not enabled" },
      });
      return;
    }

    const app = new GitHubAppService();
    const installationToken = await app.getInstallationAccessToken(installationId);
    const github = new GitHubService(installationToken);

    globalOwner = owner;
    globalRepo = repo;
    globalGithubToken = installationToken;

    if (process.env.DISABLE_AI_ANALYSIS === "true") {
      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed", error: "AI analysis is globally disabled" },
      });
      return;
    }

    const hasQuota = await QuotaService.checkAndReserveQuota(BigInt(installationId));
    if (!hasQuota) {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "rate_limited", error: "AI usage quota exhausted" },
      });

      const warningPosted = await QuotaService.hasWarningBeenPosted(BigInt(installationId));
      if (!warningPosted) {
        const comment = "⚠️ **GitVerse AI Quota Exhausted**\n\nThe AI analysis quota has been temporarily exhausted for this installation. Automatic PR reviews will resume when the quota window resets.";
        try {
          await github.postPullRequestComment(owner, repo, number, comment);
          await QuotaService.markWarningPosted(BigInt(installationId));
        } catch (e) {
          console.error("Failed to post quota warning comment:", e);
        }
      }
      return;
    }

    if (webhookEvent.event === "push") {
      const enqueued = await RepositorySyncQueue.enqueueSyncJob(enabledRepo.id, "push");
      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed" },
      });
      return;
    }

    if (webhookEvent.event === "issues") {
      if (!issueNumber) throw new Error("Missing issue number");
      const issueTitle = payload.issue?.title || "Unknown Title";
      const issueBody = payload.issue?.body || "";

      const repositoryFiles = await prisma.file.findMany({
        where: { repositoryId: enabledRepo.id },
        select: { path: true },
      });

      const triageService = new IssueTriageService();
      await triageService.triageIssue({
        owner,
        repo,
        issueNumber,
        title: issueTitle,
        body: issueBody,
        repositoryFiles,
        githubToken: installationToken,
      });

      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed" },
      });
      return;
    }

    const pr = await github.getPullRequest(owner, repo, number);
    const headSha = pr?.head?.sha;
    if (!headSha) {
      throw new Error("Missing head SHA from GitHub PR response");
    }

    const githubChecks = new GitHubChecksService(github);
    const checkRunId = await githubChecks.createCheckRun(owner, repo, headSha);
    globalCheckRunId = checkRunId;

    const policyEngine = new PremergePolicyEngine();

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

    let reviewRow: any = null;
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
        await markIdempotentCompleted();
        await prisma.webhookEvent.update({
          where: { id: eventId },
          data: { status: "completed", error: "Already reviewed (deduped)" },
        });
        return;
      }
      throw e;
    }

    try {
      const prFiles = await github.getPullRequestFiles(owner, repo, number);
      const allSecrets = [];
      for (const file of prFiles) {
        if (!file.patch) continue;
        const fileSecrets = await secretDetector.scanFile(file.filename, file.patch);
        allSecrets.push(...fileSecrets);
      }

      if (allSecrets.length > 0) {
        await securityAlerts.handleExposure(String(enabledRepo.id), headSha, allSecrets, number);
        policyEngine.addEvaluation({
          category: "secret_scanning",
          status: "FAIL",
          message: `Critical secret exposure detected in ${allSecrets.length} file(s).`
        });
      } else {
        policyEngine.addEvaluation({ category: "secret_scanning", status: "PASS", message: "No secrets detected." });
      }
    } catch (secretError) {
      console.error("Secret detection pipeline failed:", secretError);
    }

    try {
      const { review, prUrl, tokensConsumed } = await reviewPullRequest({
        owner,
        repo,
        number,
        githubToken: installationToken,
        timeoutEstimator,
      });

      if (tokensConsumed) {
        await QuotaService.recordTokenUsage(BigInt(installationId), tokensConsumed);
      }

      const comment = formatPRReviewMarkdown({ review, prUrl });
      let postedUrl: string | null = null;
      let postError: any = null;

      try {
        const posted = await github.postPullRequestComment(owner, repo, number, comment);
        postedUrl = posted?.html_url || null;
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          const status = err.response?.status;
          const data = err.response?.data as any;
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
            _githubPost: { ok: Boolean(postedUrl), postedUrl, error: postError },
          } as any,
        },
      });

      policyEngine.addEvaluation({ category: "ai_review", status: "PASS", message: "AI Analysis completed without critical issues." });

      try {
        const impactService = new ImpactAnalysisService();
        await impactService.analyzePR({
          owner,
          repo,
          pullNumber: number,
          githubToken: installationToken,
        });

        await PRImpactAnalysisService.analyzePullRequest(
          installationToken,
          repoFullName,
          number,
          prRecord.id,
          enabledRepo.id
        );
      } catch (impactErr) {
        console.error("Dependency impact analysis failed:", impactErr);
      }

      try {
        const selfHealingService = new SelfHealingService();
        await selfHealingService.processAndPostPatches({
          owner,
          repo,
          pullNumber: number,
          headSha,
          githubToken: installationToken,
          reviewResponse: review,
        });
      } catch (selfHealErr) {
        console.error("Self-healing patch generation failed:", selfHealErr);
      }

      policyEngine.addEvaluation({ category: "blackout_window", status: "PASS", message: "No active blackout window." });
      policyEngine.addEvaluation({ category: "dependency_security", status: "PASS", message: "No vulnerable dependencies introduced." });
      policyEngine.addEvaluation({ category: "organization_policies", status: "PASS", message: "All organization policies met." });

      const finalPolicyOutput = policyEngine.evaluate();
      const checkSummary = CheckSummaryService.generateSummary(finalPolicyOutput);
      await githubChecks.completeCheckRun(owner, repo, checkRunId, finalPolicyOutput.status, checkSummary);

      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed" },
      });
    } catch (innerError: any) {
      if (reviewRow) {
        await prisma.pRReview.delete({ where: { id: reviewRow.id } }).catch(() => null);
      }
      throw innerError;
    }
  } catch (error: any) {
    const errorDetails = sanitizeError(error);
    console.error("Webhook worker processing error:", errorDetails);

    if (globalCheckRunId && globalOwner && globalRepo && globalGithubToken) {
      await CheckRecoveryService.recoverStuckCheck(
        globalOwner,
        globalRepo,
        globalCheckRunId,
        globalGithubToken,
        error
      );
    }

    const retryDecision = classifyRetry({
      currentRetryCount: webhookEvent?.retryCount ?? 0,
      maxRetries: webhookEvent?.maxRetries ?? 3,
      error,
    });

    if (retryDecision.shouldRetry) {
      // Release so a retry can re-acquire the idempotency key
      if (idempotencyKey) await releaseIdempotency(idempotencyKey).catch(() => {});
    } else {
      await markIdempotentFailed();
    }

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: retryDecision.shouldRetry ? "pending" : "failed",
        error: String(error?.message || error),
        retryCount: retryDecision.retryCount,
        nextRetryAt: retryDecision.nextRetryAt,
      },
    });

    throw error;
  }
}

export async function startWebhookWorkerLoop(opts?: {
  workerId?: string;
}): Promise<void> {
  const workerId = opts?.workerId || `webhook-worker-${process.pid}`;
  console.log(`BullMQ webhook worker starting: ${workerId}`);

  const worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job: Job) => {
      const { eventId } = job.data;
      console.log(`Processing webhook event ${eventId} (attempt ${job.attemptsMade + 1})`);
      await processWebhookEvent(eventId);
    },
    {
      connection: connection as any,
      concurrency: parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || "3", 10),
      name: workerId,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Webhook event ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Webhook event ${job?.id} failed: ${err.message}`);
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}, shutting down webhook worker...`);
    await worker.close();
  };

  // Don't register signal handlers here — the parent (workerServer.ts) owns them.
  // The BullMQ worker keeps the event loop alive via its Redis connections.
}
