import { getRegionRouterService } from "../region-router";
import { getComplianceEnforcementService } from "../compliance-enforcement";
import { getRegionAiRouterService } from "../region-ai-router";
import { DataResidencyRegion } from "@prisma/client";
import { getComplianceAuditService } from "../compliance-audit";

// Mock Prisma
jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: jest.fn(),
    },
    repository: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe("Multi-Region Data Residency & Compliance", () => {
  let prismaMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = require("../../prisma").default;
  });

  describe("Scenario 1 & 2 & 3: Routing by Organization Region", () => {
    it("should route to US for US organization", async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ dataResidencyRegion: DataResidencyRegion.US });
      const router = getRegionRouterService();
      const region = await router.determineActiveRegion({ organizationId: "org-1" });
      expect(region).toBe(DataResidencyRegion.US);
    });

    it("should route to EU for EU organization", async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ dataResidencyRegion: DataResidencyRegion.EU });
      const router = getRegionRouterService();
      const region = await router.determineActiveRegion({ organizationId: "org-2" });
      expect(region).toBe(DataResidencyRegion.EU);
    });

    it("should route to APAC for APAC organization", async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ dataResidencyRegion: DataResidencyRegion.APAC });
      const router = getRegionRouterService();
      const region = await router.determineActiveRegion({ organizationId: "org-3" });
      expect(region).toBe(DataResidencyRegion.APAC);
    });
  });

  describe("Scenario 4 & 5: Compliance Violation & Cross-Region Retrieval", () => {
    it("should throw violation if attempted region does not match target region", async () => {
      const enforcement = getComplianceEnforcementService();
      const auditLogMock = jest.spyOn(getComplianceAuditService(), "logViolation").mockResolvedValue();

      await expect(
        enforcement.enforceCompliance({
          organizationId: "org-eu",
          targetRegion: DataResidencyRegion.EU,
          attemptedRegion: DataResidencyRegion.US,
          action: "AI_PROCESSING",
          resource: "repository",
        })
      ).rejects.toThrow(/ComplianceViolation/);

      expect(auditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-eu",
          attemptedRegion: DataResidencyRegion.US,
        })
      );
    });

    it("should allow if regions match", async () => {
      const enforcement = getComplianceEnforcementService();
      await expect(
        enforcement.enforceCompliance({
          organizationId: "org-eu",
          targetRegion: DataResidencyRegion.EU,
          attemptedRegion: DataResidencyRegion.EU,
          action: "AI_PROCESSING",
          resource: "repository",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Scenario 6: Region AI Router enforces compliance", () => {
    it("should resolve AI region properly and block invalid requests", async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ dataResidencyRegion: DataResidencyRegion.EU });
      
      const aiRouter = getRegionAiRouterService();
      
      await expect(
        aiRouter.routeAiRequest({
          organizationId: "org-eu",
          requestedByRegion: DataResidencyRegion.US,
          resource: "chat",
          action: "query",
        })
      ).rejects.toThrow();
    });
  });
});
