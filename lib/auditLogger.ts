/**
 * Audit Logger
 *
 * Records sensitive user actions (repository deletions, token revocations,
 * large-scale exports, MFA changes, etc.) for administrative monitoring
 * and anomaly detection.
 *
 * Writes to both:
 *   - The `AuditLog` Prisma model (persistent, queryable)
 *   - Application logger (for real-time log aggregation)
 */

import prisma from "@/lib/prisma";

export type AuditAction =
  | "REPOSITORY_DELETED"
  | "REPOSITORY_EXPORTED"
  | "TOKEN_REVOKED"
  | "TOKEN_REFRESHED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PASSWORD_CHANGED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_VERIFIED"
  | "MFA_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "FILE_CONTENT_ACCESSED"
  | "AI_ANALYSIS_REQUESTED"
  | "ORGANIZATION_MEMBER_ADDED"
  | "ORGANIZATION_MEMBER_REMOVED"
  | "POLICY_CHANGED"
  | "GITHUB_TOKEN_REVOKED"
  | "BULK_CODE_EXPORT";

export interface AuditLogEntry {
  /** Authenticated user performing the action */
  userId?: number;
  /** Organization context (optional) */
  organizationId?: string;
  /** Repository involved (optional) */
  repositoryId?: number;
  /** What was done */
  action: AuditAction;
  /** Primary resource affected, e.g. "Repository", "User", "Token" */
  resource: string;
  /** Structured metadata — never include raw secrets or tokens */
  details: Record<string, unknown>;
  /** Client IP address for geo-anomaly detection */
  ipAddress?: string;
}

/**
 * Persists an audit log entry to the database.
 * Errors are swallowed so audit failures never block the main request flow.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const {
      userId,
      organizationId,
      repositoryId,
      action,
      resource,
      details,
      ipAddress,
    } = entry;

    const sanitizedDetails = sanitizeDetails({ ...details, ipAddress });

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        organizationId: organizationId ?? null,
        repositoryId: repositoryId ?? null,
        action,
        resource,
        details: sanitizedDetails,
      },
    });

    // Also emit to application logger for stream-based alerting
    console.info(
      "[AuditLog]",
      JSON.stringify({ action, resource, userId, details: sanitizedDetails }),
    );
  } catch (err) {
    // Audit log failures must not propagate to callers
    console.error("[AuditLog] Failed to persist audit event:", err);
  }
}

/**
 * Removes sensitive fields from audit details before storing.
 * Ensures tokens, passwords, and raw secrets are never logged.
 */
function sanitizeDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const REDACTED = "[REDACTED]";
  const SENSITIVE_KEYS = new Set([
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "secret",
    "totpSecret",
    "privateKey",
    "apiKey",
  ]);

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.has(key) ? REDACTED : value,
    ]),
  );
}

/**
 * Fetches recent audit events for a user (for dashboard display).
 */
export async function getUserAuditLogs(
  userId: number,
  limit = 50,
  offset = 0,
): Promise<
  {
    id: string;
    action: string;
    resource: string;
    details: unknown;
    createdAt: Date;
  }[]
> {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      action: true,
      resource: true,
      details: true,
      createdAt: true,
    },
  });
}

/**
 * Fetches recent audit events for an organization.
 */
export async function getOrganizationAuditLogs(
  organizationId: string,
  limit = 100,
  offset = 0,
): Promise<
  {
    id: string;
    action: string;
    resource: string;
    userId: number | null;
    details: unknown;
    createdAt: Date;
  }[]
> {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      action: true,
      resource: true,
      userId: true,
      details: true,
      createdAt: true,
    },
  });
}
