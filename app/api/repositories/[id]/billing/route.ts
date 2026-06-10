import { NextRequest, NextResponse } from "next/server";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";
import { SettingsAuditService } from "@/services/security/settings-audit";
import prisma from "@/lib/prisma";
import { QuotaService } from "@/lib/services/quotaService";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

/**
 * GET /api/repositories/[id]/billing
 * Retrieves billing/quota information for a repository's installation.
 * Strictly restricted to ORG_ADMIN and REPO_ADMIN roles.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repositoryId = Number(params.id);
    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    const permission = await enforceRepositoryPermission(request, repositoryId, 'billing_read');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    // Look up the organization assignment
    const assignment = await prisma.repositoryPolicyAssignment.findUnique({
      where: { repositoryId },
      select: { organizationId: true },
    });

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { url: true, userId: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    let repoFullName = "";
    const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      repoFullName = `${match[1]}/${match[2]}`.replace(/\.git$/, "");
    }

    if (!repoFullName) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400, headers: securityHeaders }
      );
    }

    let quotaInfo = null;
    const githubRepo = await prisma.gitHubRepo.findUnique({
      where: {
        userId_repoFullName: {
          userId: repository.userId,
          repoFullName,
        },
      },
      select: { installationId: true },
    });

    if (githubRepo && githubRepo.installationId !== null) {
      const quota = await prisma.aiQuota.findUnique({
        where: { installationId: githubRepo.installationId },
        select: {
          requestsUsed: true,
          tokensConsumed: true,
          quotaWindowStart: true,
          warningPosted: true,
        },
      });

      if (quota) {
        quotaInfo = {
          tokensUsed: quota.requestsUsed,
          tokenLimit: QuotaService.getQuotaMax(),
          windowStart: quota.quotaWindowStart,
          warningPosted: quota.warningPosted,
        };
      }
    }

    return NextResponse.json(
      {
        billing: {
          repositoryId,
          organizationId: assignment?.organizationId || null,
          quota: quotaInfo,
        },
      },
      { headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Error fetching billing info:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch billing information" },
      { status: 500, headers: securityHeaders }
    );
  }
}

/**
 * PUT /api/repositories/[id]/billing
 * Updates billing/quota settings for a repository.
 * Strictly restricted to ORG_ADMIN and REPO_ADMIN roles.
 * All changes are recorded in the audit log.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repositoryId = Number(params.id);
    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400, headers: securityHeaders }
      );
    }

    const permission = await enforceRepositoryPermission(request, repositoryId, 'billing_write');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const body = await request.json();

    const assignment = await prisma.repositoryPolicyAssignment.findUnique({
      where: { repositoryId },
      select: { organizationId: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Repository is not assigned to an organization" },
        { status: 400, headers: securityHeaders }
      );
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { url: true, userId: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    let repoFullName = "";
    const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      repoFullName = `${match[1]}/${match[2]}`.replace(/\.git$/, "");
    }

    if (!repoFullName) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400, headers: securityHeaders }
      );
    }

    const githubRepo = await prisma.gitHubRepo.findUnique({
      where: {
        userId_repoFullName: {
          userId: repository.userId,
          repoFullName,
        },
      },
      select: { installationId: true },
    });

    if (!githubRepo || githubRepo.installationId === null) {
      return NextResponse.json(
        { error: "No GitHub installation found for this repository" },
        { status: 404, headers: securityHeaders }
      );
    }

    const installationId = githubRepo.installationId;

    // Fetch current quota for audit trail
    const currentQuota = await prisma.aiQuota.findUnique({
      where: { installationId },
    });

    const previousUsage = currentQuota ? currentQuota.requestsUsed : null;

    // Reset quota record using schema fields
    const now = new Date();
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const quotaWindowEnd = new Date(now.getTime() + windowMs);

    await prisma.aiQuota.upsert({
      where: { installationId },
      update: {
        requestsUsed: 0,
        tokensConsumed: 0,
        quotaWindowStart: now,
        quotaWindowEnd,
        warningPosted: false,
      },
      create: {
        installationId,
        requestsUsed: 0,
        tokensConsumed: 0,
        quotaWindowStart: now,
        quotaWindowEnd,
        warningPosted: false,
      },
    });

    // Persist audit log
    await SettingsAuditService.logChange({
      userId: permission.userId,
      repositoryId,
      organizationId: assignment.organizationId,
      action: "billing_quota_reset",
      previousValue: previousUsage !== null ? String(previousUsage) : "unset",
      newValue: "0",
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(
      { message: "Billing quota reset successfully" },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Error updating billing settings:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to update billing settings" },
      { status: 500, headers: securityHeaders }
    );
  }
}
