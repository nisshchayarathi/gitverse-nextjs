import { orgPolicyEngine } from "../org-policy-engine";
import prisma from "../../prisma";

jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    repositoryPolicyAssignment: {
      findUnique: jest.fn(),
    }
  }
}));

describe("OrganizationPolicyEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return default un-enforced policy if no org policy exists", async () => {
    (prisma.repositoryPolicyAssignment.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const policy = await orgPolicyEngine.getEffectivePolicy(1);

    expect(policy.isInherited).toBe(false);
    expect(policy.isLocked).toBe(false);
    expect(policy.blockCriticalSecrets).toBe(false);
  });

  it("should inherit org policy when inheritedPolicy is true", async () => {
    (prisma.repositoryPolicyAssignment.findUnique as jest.Mock).mockResolvedValueOnce({
      inheritedPolicy: true,
      enforceSecurityReviews: false, // Override attempts (should be ignored due to inherit)
      organization: {
        policies: {
          policyLockEnabled: false,
          enforceSecurityReviews: true,
          blockCriticalSecrets: true,
        }
      }
    });

    const policy = await orgPolicyEngine.getEffectivePolicy(1);

    expect(policy.isInherited).toBe(true);
    expect(policy.enforceSecurityReviews).toBe(true);
    expect(policy.blockCriticalSecrets).toBe(true);
  });

  it("should allow override when not locked and inheritedPolicy is false", async () => {
    (prisma.repositoryPolicyAssignment.findUnique as jest.Mock).mockResolvedValueOnce({
      inheritedPolicy: false,
      enforceSecurityReviews: false, // Override allowed
      blockCriticalSecrets: false,
      organization: {
        policies: {
          policyLockEnabled: false,
          enforceSecurityReviews: true,
          blockCriticalSecrets: true,
        }
      }
    });

    const policy = await orgPolicyEngine.getEffectivePolicy(1);

    expect(policy.isInherited).toBe(false);
    expect(policy.isLocked).toBe(false);
    expect(policy.enforceSecurityReviews).toBe(false);
    expect(policy.blockCriticalSecrets).toBe(false);
  });

  it("should ignore override and enforce org policy when locked", async () => {
    (prisma.repositoryPolicyAssignment.findUnique as jest.Mock).mockResolvedValueOnce({
      inheritedPolicy: false,
      enforceSecurityReviews: false, // Override attempt
      blockCriticalSecrets: false,
      organization: {
        policies: {
          policyLockEnabled: true, // LOCKED
          enforceSecurityReviews: true,
          blockCriticalSecrets: true,
        }
      }
    });

    const policy = await orgPolicyEngine.getEffectivePolicy(1);

    expect(policy.isLocked).toBe(true);
    // Locked forces the org policy values regardless of repo settings
    expect(policy.enforceSecurityReviews).toBe(true);
    expect(policy.blockCriticalSecrets).toBe(true);
  });
});
