export type RepositoryRole = "ORG_ADMIN" | "REPO_ADMIN" | "CONTRIBUTOR" | "VIEWER";

export interface RepositoryAccessResult {
  allowed: boolean;
  role?: RepositoryRole;
  reason?: string;
  repositoryExists: boolean;
}

export interface AuthorizationAuditEntry {
  timestamp: string;
  userId: number;
  repositoryId: number;
  action: 'policy_read' | 'policy_write' | 'policy_delete' | 'unauthorized_attempt';
  success: boolean;
  role?: string;
  reason?: string;
}
