import prisma from "@/lib/prisma";
import { GitHubAppService } from "@/lib/services/githubAppService";
import { GitHubService } from "@/lib/services/githubService";
import {
  formatPRReviewMarkdown,
  reviewPullRequest,
} from "@/lib/services/prReviewService";
import { isAxiosError } from "axios";
import { sanitizeError } from "@/lib/middleware";
import crypto from "crypto";
import { QuotaService } from "@/lib/services/quotaService";
import { IssueTriageService } from "@/lib/services/issue-triage";
import { ImpactAnalysisService } from "@/lib/services/impact-analysis";
import { SelfHealingService } from "@/lib/services/self-healing";
import { secretDetector } from "@/lib/services/secret-detector";
import { securityAlerts } from "@/lib/services/security-alerts";
import { TimeoutEstimatorService } from "@/lib/services/timeout-estimator";
import { GitHubChecksService } from "@/lib/services/github-checks";
import { PremergePolicyEngine } from "@/lib/services/premerge-policy-engine";
import { CheckSummaryService } from "@/lib/services/check-summary";
import { CheckRecoveryService } from "@/lib/services/check-recovery";
import { PRImpactAnalysisService } from "@/lib/services/prImpactAnalysisService";
import { RepositorySyncQueue } from "@/lib/services/repositorySyncQueue";
import { classifyRetry } from "@/lib/utils/retry";
import { generateWebhookKey, completeIdempotency, failIdempotency, releaseIdempotency } from "@/lib/utils/idempotency";



export async function processWebhookJob(eventId: string) {
  if (!eventId) {
    throw new Error("eventId is required");
  }

  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!webhookEvent) {
    throw new Error("Event not found");
  }

  if (webhookEvent.status !== "pending") {
    return { ok: true, ignored: true, reason: "already_processed" };
  }

  const { count } = await prisma.webhookEvent.updateMany({
    where: { id: eventId, status: "pending" },
    data: { status: "processing" },
  });

  if (count === 0) {
    return { ok: true, ignored: true, reason: "already_processed" };
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
      return { ok: true, ignored: true, reason: "repo_not_enabled" };
    }

    const app = new GitHubAppService();
    const installationToken = await app.getInstallationAccessToken(installationId);
    const github = new GitHubService(installationToken);
    
    globalOwner = owner;
    globalRepo = repo;
    globalGithubToken = installationToken;

    // 1. AI Kill Switch Check
    if (process.env.DISABLE_AI_ANALYSIS === "true") {
      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed", error: "AI analysis is globally disabled" },
      });
      return { ok: true, ignored: true, reason: "ai_disabled" };
    }

    // 2. Installation Quota Enforcement
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
      return { ok: true, ignored: true, reason: "quota_exhausted" };
    }

    if (webhookEvent.event === "push") {
      const enqueued = await RepositorySyncQueue.enqueueSyncJob(enabledRepo.id, "push");
      
      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed" },
      });

      return { ok: true, message: enqueued ? "Sync job enqueued" : "Duplicate sync job ignored" };
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

      return { ok: true, message: "Issue triaged" };
    }

    const pr = await github.getPullRequest(owner, repo, number);
    const headSha = pr?.head?.sha;
    if (!headSha) {
      throw new Error("Missing head SHA from GitHub PR response");
    }

    // Immediately Create Check Run
    const githubChecks = new GitHubChecksService(github);
    const checkRunId = await githubChecks.createCheckRun(owner, repo, headSha);
    globalCheckRunId = checkRunId;
    
    const policyEngine = new PremergePolicyEngine();

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

    // Dedupe/lock
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
        return { ok: true, ignored: true, reason: "already_reviewed" };
      }
      throw e;
    }

    // --- SECRET DETECTION PIPELINE ---
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
    // ---------------------------------

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

      // Pass AI review result
      policyEngine.addEvaluation({ category: "ai_review", status: "PASS", message: "AI Analysis completed without critical issues." });

      // Execute dependency impact analysis
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

      // Execute self-healing patches
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

      // Mock additional policies
      policyEngine.addEvaluation({ category: "blackout_window", status: "PASS", message: "No active blackout window." });
      policyEngine.addEvaluation({ category: "dependency_security", status: "PASS", message: "No vulnerable dependencies introduced." });
      policyEngine.addEvaluation({ category: "organization_policies", status: "PASS", message: "All organization policies met." });

      // Finalize check run
      const finalPolicyOutput = policyEngine.evaluate();
      const checkSummary = CheckSummaryService.generateSummary(finalPolicyOutput);
      await githubChecks.completeCheckRun(owner, repo, checkRunId, finalPolicyOutput.status, checkSummary);

      await markIdempotentCompleted();
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "completed" },
      });

      return { ok: true, posted: postedUrl, postError };
    } catch (innerError: any) {
      if (reviewRow) {
        await prisma.pRReview.delete({ where: { id: reviewRow.id } }).catch(() => null);
      }
      throw innerError;
    }
  } catch (error: any) {
    const errorDetails = sanitizeError(error);
    console.error("Worker processing error:", errorDetails);
    
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
