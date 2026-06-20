import { NextRequest, NextResponse } from "next/server";
import { sanitizeError, isHttpError } from "@/lib/middleware";
import { enforceRepositoryPermission } from "@/middleware/repository-permissions";
import { SettingsAuditService } from "@/services/security/settings-audit";

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

/**
 * GET /api/repositories/[id]/settings/audit-log
 * Retrieves the audit trail for settings and billing changes on this repository.
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

    const permission = await enforceRepositoryPermission(request, repositoryId, 'settings_read');
    if (!permission.allowed && permission.errorResponse) {
      return permission.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    const logs = await SettingsAuditService.getLogsForRepository(repositoryId, limit);

    return NextResponse.json({ logs }, { headers: securityHeaders });
  } catch (error: any) {
    console.error("Error fetching settings audit log:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: securityHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500, headers: securityHeaders }
    );
  }
}
