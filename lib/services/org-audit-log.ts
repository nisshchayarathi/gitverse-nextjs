import prisma from "../prisma";

export class OrgAuditLogService {
  /**
   * Logs an organization-level event for compliance and observability.
   */
  async logEvent(params: {
    organizationId?: string;
    repositoryId?: number;
    userId?: number;
    action: string;
    resource: string;
    details: Record<string, any>;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          repositoryId: params.repositoryId,
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          details: params.details,
        },
      });
      console.log(`[AuditLog] ${params.action} on ${params.resource}`);
    } catch (error) {
      console.error("[AuditLog] Failed to persist audit log:", error);
    }
  }
}

export const orgAuditLogService = new OrgAuditLogService();
