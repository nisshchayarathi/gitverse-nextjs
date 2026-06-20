import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export enum Role {
  ORG_ADMIN = "ORG_ADMIN",
  REPO_ADMIN = "REPO_ADMIN",
  CONTRIBUTOR = "CONTRIBUTOR",
}

export class RBACService {
  /**
   * Verifies if a user has the required role for a specific organization.
   */
  public static async verifyOrgAccess(userId: number, organizationId: string, minimumRole: Role): Promise<boolean> {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) return false;

    const roles = [Role.CONTRIBUTOR, Role.REPO_ADMIN, Role.ORG_ADMIN];
    const userRoleIndex = roles.indexOf(membership.role as Role);
    const requiredRoleIndex = roles.indexOf(minimumRole);

    return userRoleIndex >= requiredRoleIndex;
  }

  /**
   * Verifies if a user has access to a specific repository via tenant isolation rules.
   */
  public static async verifyRepoAccess(userId: number, repositoryId: number): Promise<boolean> {
    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        policyAssignment: true,
      },
    });

    if (!repo) return false;

    // If it's a direct owner
    if (repo.userId === userId) return true;

    // Check organization membership if assigned to a tenant
    if (repo.policyAssignment?.organizationId) {
      return await this.verifyOrgAccess(userId, repo.policyAssignment.organizationId, Role.CONTRIBUTOR);
    }

    return false;
  }
}
