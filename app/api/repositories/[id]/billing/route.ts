import { NextRequest, NextResponse } from "next/server";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";
import { SettingsAuditService } from "@/services/security/settings-audit";
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

    // Look up the organization assignment and any associated AI quota
    const assignment = await prisma.repositoryPolicyAssignment.findUnique({
      where: { repositoryId },
      select: { organizationId: true },
    });

    let quotaInfo = null;
    if (assignment) {
      // Find installation linked to the org for quota data
      const installation = await prisma.gitHubInstallation.findFirst({
        where: { organizationId: assignment.organizationId },
        select: { id: true },
      });

      if (installation) {
        quotaInfo = await prisma.aiQuota.findUnique({
          where: { installationId: installation.id },
          select: {
            tokensUsed: true,
            tokenLimit: true,
            windowStart: true,
            warningPosted: true,
          },
        });
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

    const installation = await prisma.gitHubInstallation.findFirst({
      where: { organizationId: assignment.organizationId },
      select: { id: true },
    });

    if (!installation) {
      return NextResponse.json(
        { error: "No GitHub installation found for this organization" },
        { status: 404, headers: securityHeaders }
      );
    }

    // Fetch current quota for audit trail
    const currentQuota = await prisma.aiQuota.findUnique({
      where: { installationId: installation.id },
    });

    const previousLimit = currentQuota?.tokenLimit ?? null;

    // Update or create quota record
    await prisma.aiQuota.upsert({
      where: { installationId: installation.id },
      update: { tokenLimit },
      create: {
        installationId: installation.id,
        tokenLimit,
        tokensUsed: 0,
        windowStart: new Date(),
        warningPosted: false,
      },
    });

    // Persist audit log
    await SettingsAuditService.logChange({
      userId: permission.userId,
      repositoryId,
      organizationId: assignment.organizationId,
      action: "billing_quota_update",
      previousValue: previousLimit !== null ? String(previousLimit) : "unset",
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
