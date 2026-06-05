import { DataResidencyRegion } from "@prisma/client";
import { getComplianceAuditService } from "./compliance-audit";

export class ComplianceEnforcementService {
  /**
   * Validates if a requested operation complies with the organization's data residency policy.
   * Throws an error if the operation is blocked.
   */
  public async enforceCompliance(params: {
    organizationId: string;
    repositoryId?: number;
    userId?: number;
    targetRegion: DataResidencyRegion;
    attemptedRegion: DataResidencyRegion | string;
    resource: string;
    action: string;
  }): Promise<void> {
    
    if (params.targetRegion !== params.attemptedRegion) {
      const reason = `Strict residency policy violation: Attempted to process ${params.action} on ${params.resource} in region ${params.attemptedRegion}, but policy requires ${params.targetRegion}.`;
      
      const auditService = getComplianceAuditService();
      await auditService.logViolation({
        organizationId: params.organizationId,
        repositoryId: params.repositoryId,
        userId: params.userId,
        attemptedRegion: params.attemptedRegion,
        allowedRegions: [params.targetRegion],
        resource: params.resource,
        action: params.action,
        reason,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`ComplianceViolation: ${reason}`);
    }
  }
}

let complianceEnforcementSingleton: ComplianceEnforcementService | null = null;

export function getComplianceEnforcementService(): ComplianceEnforcementService {
  if (!complianceEnforcementSingleton) {
    complianceEnforcementSingleton = new ComplianceEnforcementService();
  }
  return complianceEnforcementSingleton;
}
