import { policyEnforcementService } from "../policy-enforcement";
import { orgPolicyEngine } from "../org-policy-engine";
import { orgAuditLogService } from "../org-audit-log";

jest.mock("../org-policy-engine", () => ({
  orgPolicyEngine: {
    getEffectivePolicy: jest.fn(),
  }
}));

jest.mock("../org-audit-log", () => ({
  orgAuditLogService: {
    logEvent: jest.fn(),
  }
}));

describe("PolicyEnforcementService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("enforceSecretPolicy", () => {
    it("should allow if no critical secrets found", async () => {
      (orgPolicyEngine.getEffectivePolicy as jest.Mock).mockResolvedValueOnce({
        blockCriticalSecrets: true,
      });

      const result = await policyEnforcementService.enforceSecretPolicy({
        repositoryId: 1,
        headSha: "abc",
        hasCriticalSecrets: false,
        secretCount: 0,
      });

      expect(result.allowed).toBe(true);
      expect(orgAuditLogService.logEvent).not.toHaveBeenCalled();
    });

    it("should allow if secrets found but block policy is false", async () => {
      (orgPolicyEngine.getEffectivePolicy as jest.Mock).mockResolvedValueOnce({
        blockCriticalSecrets: false,
      });

      const result = await policyEnforcementService.enforceSecretPolicy({
        repositoryId: 1,
        headSha: "abc",
        hasCriticalSecrets: true,
        secretCount: 1,
      });

      expect(result.allowed).toBe(true);
      expect(orgAuditLogService.logEvent).not.toHaveBeenCalled();
    });

    it("should block and audit log if secrets found and policy is enforced", async () => {
      (orgPolicyEngine.getEffectivePolicy as jest.Mock).mockResolvedValueOnce({
        blockCriticalSecrets: true,
      });

      const result = await policyEnforcementService.enforceSecretPolicy({
        repositoryId: 1,
        headSha: "abc",
        hasCriticalSecrets: true,
        secretCount: 2,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Organization policy prohibits");
      expect(orgAuditLogService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POLICY_VIOLATION_BLOCKED",
          resource: "Pull Request Merge"
        })
      );
    });
  });
});
