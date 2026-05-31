import prisma from "../prisma";
import { ComplianceViolation } from "@/types/data-residency";

export class ComplianceAuditService {
  /**
   * Logs a compliance violation to the database.
   */
  public async logViolation(violation: ComplianceViolation): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: violation.organizationId,
          repositoryId: violation.repositoryId,
          userId: violation.userId,
          action: "COMPLIANCE_VIOLATION",
          resource: violation.resource,
          details: {
            reason: violation.reason,
            attemptedRegion: violation.attemptedRegion,
            allowedRegions: violation.allowedRegions,
            timestamp: violation.timestamp,
          },
        },
      });
      console.warn(`[ComplianceAudit] Logged violation for org ${violation.organizationId}: ${violation.reason}`);
    } catch (error) {
      console.error("[ComplianceAudit] Failed to log compliance violation:", error);
    }
  }

  /**
   * Logs a region migration or settings change.
   */
  public async logRegionChange(params: {
    organizationId: string;
    userId: number;
    oldRegion: string;
    newRegion: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          userId: params.userId,
          action: "REGION_CHANGE",
          resource: "Organization.dataResidencyRegion",
          details: {
            oldRegion: params.oldRegion,
            newRegion: params.newRegion,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error("[ComplianceAudit] Failed to log region change:", error);
    }
  }
}

let complianceAuditSingleton: ComplianceAuditService | null = null;

export function getComplianceAuditService(): ComplianceAuditService {
  if (!complianceAuditSingleton) {
    complianceAuditSingleton = new ComplianceAuditService();
  }
  return complianceAuditSingleton;
}
