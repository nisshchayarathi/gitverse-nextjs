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
 * GET /api/repositories/[id]/settings
 * Retrieves repository settings. Restricted to ORG_ADMIN and REPO_ADMIN roles.
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

    const permission = await enforceRepositoryPermission(request, repositoryId, 'settings_read');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true,
        defaultBranch: true,
        status: true,
        url: true,
      },
    });

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    return NextResponse.json({ settings: repository }, { headers: securityHeaders });
  } catch (error: any) {
    console.error("Error fetching repository settings:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch repository settings" },
      { status: 500, headers: securityHeaders }
    );
  }
}

/**
 * PUT /api/repositories/[id]/settings
 * Updates repository settings. Strictly restricted to ORG_ADMIN and REPO_ADMIN roles.
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

    const permission = await enforceRepositoryPermission(request, repositoryId, 'settings_write');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const body = await request.json();
    const { description, isPrivate, defaultBranch } = body;

    // Fetch current values for audit trail
    const current = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { description: true, isPrivate: true, defaultBranch: true },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404, headers: securityHeaders }
      );
    }

    // Build update data, only including changed fields
    const updateData: Record<string, any> = {};
    const changes: string[] = [];

    if (description !== undefined && description !== current.description) {
      updateData.description = description;
      changes.push(`description: "${current.description}" → "${description}"`);
    }
    if (isPrivate !== undefined && isPrivate !== current.isPrivate) {
      updateData.isPrivate = isPrivate;
      changes.push(`isPrivate: ${current.isPrivate} → ${isPrivate}`);
    }
    if (defaultBranch !== undefined && defaultBranch !== current.defaultBranch) {
      updateData.defaultBranch = defaultBranch;
      changes.push(`defaultBranch: "${current.defaultBranch}" → "${defaultBranch}"`);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "No changes detected" },
        { status: 200, headers: securityHeaders }
      );
    }

    const updated = await prisma.repository.update({
      where: { id: repositoryId },
      data: updateData,
    });

    // Persist audit log
    await SettingsAuditService.logChange({
      userId: permission.userId,
      repositoryId,
      action: "repository_settings_update",
      previousValue: JSON.stringify(current),
      newValue: JSON.stringify(updateData),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(
      { message: "Settings updated successfully", changes },
      { status: 200, headers: securityHeaders }
    );
  } catch (error: any) {
    console.error("Error updating repository settings:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to update repository settings" },
      { status: 500, headers: securityHeaders }
    );
  }
}
