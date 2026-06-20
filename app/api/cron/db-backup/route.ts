/**
 * GET /api/cron/db-backup
 *
 * Creates a compressed pg_dump snapshot of the primary database and uploads
 * it to S3 (if BACKUP_S3_BUCKET is configured) or saves it to the local
 * backup directory.
 *
 * ════════════════════════════════════════════════════════════════════
 * PRODUCTION REQUIREMENTS
 * ════════════════════════════════════════════════════════════════════
 *
 *   • pg_dump must be installed on the host (included in standard
 *     PostgreSQL client packages).  Vercel serverless functions do not
 *     include pg_dump — use a Vercel CRON on a dedicated server/worker
 *     or install the Postgres client tools in the build image.
 *
 *   • Set BACKUP_DATABASE_URL to a read-replica or the primary database
 *     URL.  If not set, falls back to DATABASE_URL.
 *
 *   • Set BACKUP_S3_BUCKET + AWS credentials (AWS_ACCESS_KEY_ID etc.)
 *     to enable cloud upload.  Without these, the dump stays on the
 *     local filesystem (ephemeral on Vercel — lost after the function
 *     cold-starts).
 *
 *   • BACKUP_RETENTION_DAYS (default 7) controls automatic cleanup of
 *     old backups from S3 and the local backup directory.
 *
 *   • The route is authenticated with the CRON_SECRET (set this in
 *     Vercel Environment Variables and in vercel.json crons section).
 *
 * ════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/utils/internalAuth";
import { handleBackup } from "@/lib/services/backupService";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await handleBackup();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          backupId: result.backupId,
          error: result.error,
          timestamp: result.timestamp,
          durationMs: result.durationMs,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      backupId: result.backupId,
      location: result.location,
      sizeBytes: result.sizeBytes,
      checksumSha256: result.checksumSha256,
      timestamp: result.timestamp,
      durationMs: result.durationMs,
    });
  } catch (error: any) {
    console.error("[BackupCron] Backup failed:", error);
    return NextResponse.json(
      { error: "Database backup failed", details: error?.message },
      { status: 500 },
    );
  }
}
