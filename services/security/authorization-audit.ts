import { AuthorizationAuditEntry } from "../../types/repository-permissions";

export class AuthorizationAudit {
  /**
   * Records a security authorization audit event with structured log payload.
   */
  public static log(entry: Omit<AuthorizationAuditEntry, 'timestamp'>): void {
    const timestamp = new Date().toISOString();
    
    const payload = {
      timestamp,
      userId: entry.userId,
      repositoryId: entry.repositoryId,
      action: entry.action,
      success: entry.success,
      role: entry.role || 'NONE',
      reason: entry.reason || 'N/A',
    };

    if (entry.success) {
      console.log(`[AUTHZ AUDIT] Success: ${entry.action.toUpperCase()} - User ID: ${entry.userId} - Repo ID: ${entry.repositoryId}`, JSON.stringify(payload));
    } else {
      console.error(`[AUTHZ AUDIT] FAILURE: ${entry.action.toUpperCase()} - User ID: ${entry.userId} - Repo ID: ${entry.repositoryId} - Reason: ${entry.reason}`, JSON.stringify(payload));
    }
  }
}
