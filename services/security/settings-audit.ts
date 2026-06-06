import prisma from "@/lib/prisma";

export interface SettingsChangeEntry {
  userId: number;
  repositoryId?: number;
  organizationId?: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}

/**
 * Persists audit log entries for settings and billing changes to the database.
 * Implements the audit trail requirement from issue #1891.
 */
export class SettingsAuditService {
  /**
   * Records a settings or billing change event to the AuditLog table.
   */
  public static async logChange(entry: SettingsChangeEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.action.split("_")[0] || "settings",
          repositoryId: entry.repositoryId,
          organizationId: entry.organizationId,
          details: {
            previousValue: entry.previousValue,
            newValue: entry.newValue,
            ipAddress: entry.ipAddress,
            timestamp: new Date().toISOString(),
          },
        },
      });

      console.log(
        `[SETTINGS AUDIT] ${entry.action} by User ${entry.userId}` +
        (entry.repositoryId ? ` on Repo ${entry.repositoryId}` : "") +
        (entry.organizationId ? ` on Org ${entry.organizationId}` : "")
      );
    } catch (error) {
      // Audit logging must never break the primary operation.
      // Log to console as a fallback.
      console.error("[SETTINGS AUDIT] Failed to persist audit log:", error);
      console.error("[SETTINGS AUDIT] Entry:", JSON.stringify(entry));
    }
  }

  /**
   * Retrieves audit log entries for a specific repository.
   */
  public static async getLogsForRepository(
    repositoryId: number,
    limit: number = 50
  ) {
    return prisma.auditLog.findMany({
      where: {
        repositoryId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Retrieves audit log entries for a specific organization.
   */
  public static async getLogsForOrganization(
    organizationId: string,
    limit: number = 50
  ) {
    return prisma.auditLog.findMany({
      where: {
        organizationId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
