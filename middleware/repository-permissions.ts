import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { RepositoryAccess } from "../services/authz/repository-access";
import { RBAC } from "../services/authz/rbac";
import { AuthorizationAudit } from "../services/security/authorization-audit";

export interface EnforcedPermissionResult {
  allowed: boolean;
  userId: number;
  errorResponse?: NextResponse;
}

/**
 * Enforces repository access permissions on standard Next.js NextRequest routes.
 */
export async function enforceRepositoryPermission(
  request: NextRequest,
  repositoryId: number,
  requiredAction: 'read' | 'write'
): Promise<EnforcedPermissionResult> {
  try {
    const user = await requireAuth(request);
    
    // 1. Perform authorization lookup flow
    const check = await RepositoryAccess.checkAccess(repositoryId, user.userId);
    
    if (!check.allowed || !check.role) {
      AuthorizationAudit.log({
        userId: user.userId,
        repositoryId,
        action: 'unauthorized_attempt',
        success: false,
        reason: check.reason || "Unauthorized access",
      });

      // Avoid repository enumeration: Return 404 for non-existent or unauthorized access
      return {
        allowed: false,
        userId: user.userId,
        errorResponse: NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        ),
      };
    }

    // 2. Perform RBAC validation
    let hasPermission = false;
    if (requiredAction === 'write') {
      hasPermission = RBAC.canModifyPolicy(check.role);
    } else {
      hasPermission = RBAC.canReadPolicy(check.role);
    }

    if (!hasPermission) {
      AuthorizationAudit.log({
        userId: user.userId,
        repositoryId,
        action: 'unauthorized_attempt',
        success: false,
        role: check.role,
        reason: `Insufficient role permissions for ${requiredAction} action`,
      });

      return {
        allowed: false,
        userId: user.userId,
        errorResponse: NextResponse.json(
          { error: "Forbidden: Insufficient role permission" },
          { status: 403 }
        ),
      };
    }

    // Access granted
    AuthorizationAudit.log({
      userId: user.userId,
      repositoryId,
      action: requiredAction === 'write' ? 'policy_write' : 'policy_read',
      success: true,
      role: check.role,
    });

    return {
      allowed: true,
      userId: user.userId,
    };
  } catch (error: any) {
    console.error("[enforceRepositoryPermission] Unexpected authorization error:", error);
    return {
      allowed: false,
      userId: 0,
      errorResponse: NextResponse.json(
        { error: "Internal authorization check failed" },
        { status: 500 }
      ),
    };
  }
}
