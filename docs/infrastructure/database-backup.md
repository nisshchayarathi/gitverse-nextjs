# Database Backup Infrastructure

## Overview

The database backup system creates periodic compressed snapshots of the primary PostgreSQL database using `pg_dump`.  Backups can be stored on the local filesystem or uploaded to S3 (when configured).

## Architecture

```
                    ┌──────────────────────┐
                    │  Vercel CRON / Manual │
                    │  GET /api/cron/db-backup│
                    └──────────┬───────────┘
                               │ Authorization: Bearer <CRON_SECRET>
                               ▼
                    ┌──────────────────────┐
                    │  isCronAuthorized()   │
                    │  lib/utils/internalAuth│
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  handleBackup()       │
                    │  lib/services/backupService│
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────┐ ┌──────────────┐
    │ pg_dump + gzip  │ │ S3 Upload│ │ Cleanup Old  │
    │ → .sql.gz file  │ │ (optional)│ │ Backups (TTL)│
    └─────────────────┘ └──────────┘ └──────────────┘
```

## Backup Flow

1. **Authorization**: The route validates the `Authorization` header using `isCronAuthorized()` (supports both direct `CRON_SECRET` match and SHA-256 derived bearer token).

2. **pg_dump execution**: `exec` runs `pg_dump --no-owner --no-acl --quote-all-identifiers` against `BACKUP_DATABASE_URL` (falls back to `DATABASE_URL`). Output is piped through gzip (level 6) for compression.

3. **File output**: The compressed dump is written to `BACKUP_DIR` (default `/tmp/db-backups`) as `<backupId>.sql.gz`. A metadata file `<backupId>.meta.json` is also written alongside it.

4. **S3 upload** (optional): If `BACKUP_S3_BUCKET` is set, the compressed file is uploaded to S3 at `s3://<bucket>/db-backups/<timestamp>_<backupId>.sql.gz` with `STANDARD_IA` storage class. If S3 upload fails, the local copy is preserved and the route still reports success (degraded mode).

5. **Cleanup**: Old backups are removed from both S3 and the local backup directory after `BACKUP_RETENTION_DAYS` (default 7).

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SECRET` | Yes | — | Secret for Vercel CRON authorization |
| `BACKUP_DATABASE_URL` | No | `DATABASE_URL` | Database URL for backups (use read-replica if available) |
| `BACKUP_DIR` | No | `/tmp/db-backups` | Local directory for backup files |
| `BACKUP_S3_BUCKET` | No | — | S3 bucket name for cloud storage |
| `BACKUP_S3_REGION` | No | `us-east-1` | AWS region for S3 |
| `BACKUP_RETENTION_DAYS` | No | `7` | Number of days to retain backups |
| `AWS_ACCESS_KEY_ID` | For S3 | — | AWS access key for S3 upload |
| `AWS_SECRET_ACCESS_KEY` | For S3 | — | AWS secret key for S3 upload |

### Vercel.json

Register the cron in `vercel.json` to run on a schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/db-backup",
      "schedule": "0 6 * * *"
    }
  ]
}
```

The `schedule` uses cron syntax.  Examples:
- `0 6 * * *` — daily at 06:00 UTC
- `0 */6 * * *` — every 6 hours
- `0 0,12 * * *` — twice daily

### IAM Policy for S3

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-backup-bucket/db-backups/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-backup-bucket",
      "Condition": {
        "StringLike": {
          "s3:prefix": "db-backups/*"
        }
      }
    }
  ]
}
```

## Output Format

### Success Response (HTTP 200)

```json
{
  "success": true,
  "backupId": "backup-2026-06-06T06-00-00-a1b2c3d4",
  "location": "s3://backup-bucket/db-backups/2026-06-06T06-00-00_backup-....sql.gz",
  "sizeBytes": 52428800,
  "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "timestamp": "2026-06-06T06:00:00.000Z",
  "durationMs": 15234
}
```

### Failure Response (HTTP 500)

```json
{
  "success": false,
  "backupId": "backup-2026-06-06T06-00-00-z9y8x7w6",
  "error": "pg_dump: connection to server at ... failed",
  "timestamp": "2026-06-06T06:00:00.000Z",
  "durationMs": 1200
}
```

## Production Considerations

### pg_dump Availability

- **Vercel serverless**: `pg_dump` is NOT available in the default runtime image.  Use a dedicated server for backups, or build a custom runtime image that includes PostgreSQL client tools.
- **Dedicated server / worker**: Install `postgresql-client` (or equivalent) on the host.
- **Docker**: Use the `postgres` image which includes `pg_dump`:
  ```bash
  docker run --rm postgres:16 pg_dump "$DATABASE_URL" | gzip > backup.sql.gz
  ```

### Read-Replica Backups

Point `BACKUP_DATABASE_URL` to a read-replica to avoid adding load to the primary database during backup operations.  The default is the primary `DATABASE_URL`.

### Monitoring

Each backup produces:
- A structured log entry via Pino (`lib/logger.ts`)
- A metadata JSON file in the backup directory
- The HTTP response returned by the cron endpoint

Set up alerts for:
- `success: false` responses (backup failure)
- `sizeBytes` dropping significantly (possible data loss or incomplete dump)
- Missing backup within expected schedule (cron not running)

### Backup Directory

On Vercel serverless, `/tmp` is writable but ephemeral — files are lost when the function cold-starts.  Always configure `BACKUP_S3_BUCKET` for production deployments that use Vercel.  The local `BACKUP_DIR` is intended for development or non-Vercel deployments.

## Restore Procedure

```bash
# 1. Download the backup file
aws s3 cp s3://backup-bucket/db-backups/2026-06-06T06-00-00_backup-....sql.gz .

# 2. Decompress
gunzip backup.sql.gz

# 3. Restore
psql "$DATABASE_URL" < backup.sql

# 4. Verify
psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables;"
```

For differential or point-in-time recovery, use Neon's built-in branch/revert features instead of raw `pg_dump` restore.
