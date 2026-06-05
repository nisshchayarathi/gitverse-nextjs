import prisma from "../../lib/prisma";
import { RepositoryAccessResult, RepositoryRole } from "../../types/repository-permissions";

export class RepositoryAccess {
  /**
   * Validates a user's access rights to a repository.
   * Performs repository checks, ownership lookups, and organization-level RBAC role retrieval.
   */
  public static async checkAccess(
    repositoryId: number,
    userId: number
  ): Promise<RepositoryAccessResult> {
    try {
      // 1. Retrieve the repository
      const repository = await prisma.repository.findUnique({
        where: { id: repositoryId },
        select: { id: true, userId: true },
      });

      if (!repository) {
        return {
          allowed: false,
          repositoryExists: false,
          reason: "Repository not found",
        };
      }

      // 2. Personal ownership verification
      if (repository.userId === userId) {
        return {
          allowed: true,
          role: "REPO_ADMIN",
          repositoryExists: true,
        };
      }

      // 3. Organization association lookup
      const assignment = await prisma.repositoryPolicyAssignment.findUnique({
        where: { repositoryId },
        select: { organizationId: true },
      });

      if (!assignment) {
        // No organization assigned and user is not direct owner
        return {
          allowed: false,
          repositoryExists: true,
          reason: "Unauthorized access to repository",
        };
      }

      // 4. Organization membership check
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: assignment.organizationId,
            userId,
          },
        },
        select: { role: true },
      });

      if (!membership) {
        return {
          allowed: false,
          repositoryExists: true,
          reason: "User is not a member of the repository organization",
        };
      }

      /**
       * =========================================================================
       * SECURITY IMPLEMENTATION DETAIL: STRICT TYPE VALIDATION & FAIL-CLOSED RBAC
       * =========================================================================
       * 
       * Downstream authorization mechanisms depend heavily on the RepositoryRole enum types
       * to verify security clearances, perform IDOR prevention, and permit repository configuration
       * mutations. Simply casting a database string to the TypeScript `RepositoryRole` type via `as`
       * is highly dangerous because TypeScript types do not exist at runtime. If a malicious user
       * manages to inject a corrupted, custom, or privileged string into the `role` column in the
       * database, the application would proceed using an unvalidated role string, potentially causing
       * a critical privilege escalation vulnerability.
       * 
       * To implement robust Defense-in-Depth and ensure compliance with modern secure development practices,
       * we enforce strict runtime validation against a whitelist of approved roles before casting or 
       * processing.
       * 
       * Fail-Closed Security Policy:
       * - Whitelist check: If the retrieved database string is not one of the exactly matched, predefined
       *   valid roles, we immediately reject the request.
       * - Auditing & Intrusion Detection: Any unknown role is logged as a [CRITICAL] security anomaly
       *   so that automated intrusion detection systems and security operations center (SOC) analysts
       *   can trigger alert workflows and detect direct database tampering or API exploits.
       */
      const VALID_ROLES: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN", "CONTRIBUTOR", "VIEWER"];
      const role = membership.role;

      // Safe validation guarding against direct database mutations or unauthorized role injection
      if (typeof role !== "string" || !VALID_ROLES.includes(role as RepositoryRole)) {
        console.error(
          `[CRITICAL] [SECURITY_ANOMALY] Unknown or unvalidated role "${membership.role}" detected for user ${userId} on repository ${repositoryId}. Access denied under Fail-Closed policy.`
        );
        return {
          allowed: false,
          repositoryExists: true,
          reason: `Invalid organization role: ${membership.role}`,
        };
      }

      // Cast is now completely safe as we have validated it at runtime
      const validatedRole = role as RepositoryRole;

      return {
        allowed: true,
        role: validatedRole,
        repositoryExists: true,
      };
    } catch (error: any) {
      console.error("[RepositoryAccess] [SECURITY_SYSTEM] Error checking access rights:", error);
      return {
        allowed: false,
        repositoryExists: true,
        reason: `Authorization error: ${error.message || error}`,
      };
    }
  }
}
