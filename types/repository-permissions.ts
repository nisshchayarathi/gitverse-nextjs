export type RepositoryRole =
  | "ORG_ADMIN"
  | "REPO_ADMIN"
  | "CONTRIBUTOR"
  | "VIEWER";

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
<<<<<<< HEAD
  action:
    | "policy_read"
    | "policy_write"
    | "policy_delete"
    | "unauthorized_attempt";
=======
  action: 'policy_read' | 'policy_write' | 'policy_delete' | 'settings_read' | 'settings_write' | 'billing_read' | 'billing_write' | 'unauthorized_attempt';
>>>>>>> ede0d665ec4d448aa73484ccb136b2157752c0da
  success: boolean;
  role?: string;
  reason?: string;
}
