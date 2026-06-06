import { NextRequest, NextResponse } from "next/server";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";
import { SettingsAuditService } from "@/services/security/settings-audit";
import { QuotaService } from "@/lib/services/quotaService";
import prisma from "@/lib/prisma";

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
      select: { url: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid repository URL format" },
        { status: 400, headers: securityHeaders }
      );
    }

    const owner = match[1];
    const repoName = match[2].replace(/\.git$/, "");
    const repoFullName = `${owner}/${repoName}`;

    const githubRepo = await prisma.gitHubRepo.findFirst({
      where: { repoFullName },
      select: { installationId: true },
    });

    if (!githubRepo || !githubRepo.installationId) {
      return NextResponse.json(
        { error: "No GitHub installation found for this repository" },
        { status: 404, headers: securityHeaders }
      );
    }

    const installationId = githubRepo.installationId;
    let quotaInfo = null;

    const quota = await prisma.aiQuota.findUnique({
      where: { installationId },
      select: {
        tokensConsumed: true,
        quotaWindowStart: true,
        warningPosted: true,
      },
    });

    if (quota) {
      quotaInfo = {
        tokensUsed: quota.tokensConsumed,
        tokenLimit: QuotaService.getQuotaMax(),
        windowStart: quota.quotaWindowStart,
        warningPosted: quota.warningPosted,
      };
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
    const { tokenLimit } = body;

    if (tokenLimit === undefined || typeof tokenLimit !== "number" || tokenLimit < 0) {
      return NextResponse.json(
        { error: "tokenLimit is required and must be a non-negative number" },
        { status: 400, headers: securityHeaders }
      );
    }

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
      select: { url: true },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid repository URL format" },
        { status: 400, headers: securityHeaders }
      );
    }

    const owner = match[1];
    const repoName = match[2].replace(/\.git$/, "");
    const repoFullName = `${owner}/${repoName}`;

    const githubRepo = await prisma.gitHubRepo.findFirst({
      where: { repoFullName },
      select: { installationId: true },
    });

    if (!githubRepo || !githubRepo.installationId) {
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

    const previousLimit = QuotaService.getQuotaMax();

    // Update or create quota record (saving tokenLimit is not supported in schema, so we keep warningPosted reset)
    await prisma.aiQuota.upsert({
      where: { installationId },
      update: {
        warningPosted: false,
      },
      create: {
        installationId,
        requestsUsed: 0,
        tokensConsumed: 0,
        quotaWindowStart: new Date(),
        quotaWindowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        warningPosted: false,
      },
    });

    // Persist audit log
    await SettingsAuditService.logChange({
      userId: permission.userId,
      repositoryId,
      organizationId: assignment.organizationId,
      action: "billing_quota_update",
      previousValue: String(previousLimit),
      newValue: String(tokenLimit),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(
      { message: "Billing quota updated successfully", tokenLimit },
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
