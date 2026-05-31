import { orgPolicyEngine } from "./org-policy-engine";
import { orgAuditLogService } from "./org-audit-log";

export class PolicyEnforcementService {
  /**
   * Validates if a pull request should be blocked based on detected critical secrets
   * and the organization's effective policy for the repository.
   */
  async enforceSecretPolicy(params: {
    repositoryId: number;
    headSha: string;
    hasCriticalSecrets: boolean;
    secretCount: number;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await orgPolicyEngine.getEffectivePolicy(params.repositoryId);

    if (params.hasCriticalSecrets && policy.blockCriticalSecrets) {
      await orgAuditLogService.logEvent({
        repositoryId: params.repositoryId,
        action: "POLICY_VIOLATION_BLOCKED",
        resource: "Pull Request Merge",
        details: {
          reason: "Critical secrets detected and blockCriticalSecrets policy is enforced.",
          headSha: params.headSha,
          secretCount: params.secretCount,
        }
      });

      return {
        allowed: false,
        reason: "Organization policy prohibits merging when critical secrets are detected."
      };
    }

    return { allowed: true };
  }

  /**
   * Validates if a security review is required and successfully passed.
   */
  async enforceSecurityReviewPolicy(params: {
    repositoryId: number;
    headSha: string;
    aiReviewScore: number;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await orgPolicyEngine.getEffectivePolicy(params.repositoryId);

    if (policy.enforceSecurityReviews && params.aiReviewScore < 50) {
      await orgAuditLogService.logEvent({
        repositoryId: params.repositoryId,
        action: "POLICY_VIOLATION_BLOCKED",
        resource: "Security Review",
        details: {
          reason: "Security review failed minimum threshold.",
          headSha: params.headSha,
          aiReviewScore: params.aiReviewScore,
        }
      });

      return {
        allowed: false,
        reason: "Organization policy mandates a passing AI security review. Current score is below the threshold."
      };
    }

    return { allowed: true };
  }
}

export const policyEnforcementService = new PolicyEnforcementService();
