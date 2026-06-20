import prisma from "../prisma";
import { EffectiveRepositoryPolicy } from "../../types/organization-policy";

export class OrganizationPolicyEngine {
  /**
   * Resolves the effective security policy for a given repository.
   * Organization policies take precedence if policyLockEnabled is true.
   * If inheritedPolicy is true, org policies are used by default.
   */
  async getEffectivePolicy(repositoryId: number): Promise<EffectiveRepositoryPolicy> {
    const assignment = await prisma.repositoryPolicyAssignment.findUnique({
      where: { repositoryId },
      include: {
        organization: {
          include: { policies: true }
        }
      }
    });

    if (!assignment || !assignment.organization.policies) {
      // No organization policy configured, default to standard non-enforced rules
      return {
        repositoryId,
        isInherited: false,
        isLocked: false,
        enforceSecurityReviews: false,
        enforceSecretScanning: false,
        blockCriticalSecrets: false,
      };
    }

    const orgPolicy = assignment.organization.policies;
    const isLocked = orgPolicy.policyLockEnabled;
    const isInherited = assignment.inheritedPolicy;

    // Determine final values based on lock status and inheritance
    const enforceSecurityReviews = isLocked || isInherited
      ? orgPolicy.enforceSecurityReviews
      : (assignment.enforceSecurityReviews ?? orgPolicy.enforceSecurityReviews);

    const enforceSecretScanning = isLocked || isInherited
      ? orgPolicy.enforceSecretScanning
      : (assignment.enforceSecretScanning ?? orgPolicy.enforceSecretScanning);

    const blockCriticalSecrets = isLocked || isInherited
      ? orgPolicy.blockCriticalSecrets
      : (assignment.blockCriticalSecrets ?? orgPolicy.blockCriticalSecrets);

    return {
      repositoryId,
      isInherited,
      isLocked,
      enforceSecurityReviews,
      enforceSecretScanning,
      blockCriticalSecrets,
    };
  }
}

export const orgPolicyEngine = new OrganizationPolicyEngine();
