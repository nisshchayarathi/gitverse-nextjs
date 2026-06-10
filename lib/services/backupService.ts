import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";
import { logger } from "@/lib/logger";

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || "/tmp/db-backups";
const BACKUP_S3_BUCKET = process.env.BACKUP_S3_BUCKET || "";
const BACKUP_S3_REGION = process.env.BACKUP_S3_REGION || "us-east-1";
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);
const BACKUP_DATABASE_URL = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || "";

export interface BackupResult {
  success: boolean;
  backupId: string;
  location: string;
  sizeBytes: number;
  checksumSha256: string;
  timestamp: string;
  durationMs: number;
  compressed: boolean;
  error?: string;
}

function generateBackupId(): string {
  const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = crypto.randomBytes(4).toString("hex");
  return `backup-${date}-${suffix}`;
}

async function computeSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}

async function runPgDump(databaseUrl: string, outputPath: string): Promise<void> {
  const dumpCmd = `pg_dump --no-owner --no-acl --quote-all-identifiers "${databaseUrl}"`;
  const gzip = createGzip({ level: 6 });
  const outStream = createWriteStream(outputPath);

  try {
    await execAsync(`${dumpCmd} | gzip -c > ${outputPath}`, {
      timeout: 5 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 1024,
    });
  } catch {
    await execAsync(dumpCmd, {
      timeout: 5 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 1024,
    }).then(async (result) => {
      const source = Buffer.from(result.stdout, "utf-8");
      await pipeline(
        require("stream").Readable.from(source),
        gzip,
        outStream,
      );
    });
  }
}

async function uploadToS3(
  filePath: string,
  remoteKey: string,
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: BACKUP_S3_REGION });
  const fileContent = await fs.readFile(filePath);
  const bucket = process.env.BACKUP_S3_BUCKET || "";

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: remoteKey,
      Body: fileContent,
      ContentType: "application/gzip",
      StorageClass: "STANDARD_IA",
    }),
  );

  return `s3://${bucket}/${remoteKey}`;
}

function getEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = process.env[key];
    if (val) return val;
  }
  return undefined;
}

export async function handleBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId();

  const databaseUrl = getEnvValue("BACKUP_DATABASE_URL", "DATABASE_URL");
  if (!databaseUrl) {
    const msg = "No DATABASE_URL configured for backup";
    logger.error({ backupId }, msg);
    return {
      success: false,
      backupId,
      location: "",
      sizeBytes: 0,
      checksumSha256: "",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      compressed: false,
      error: msg,
    };
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const compressedPath = path.join(BACKUP_DIR, `${backupId}.sql.gz`);
  const metaPath = path.join(BACKUP_DIR, `${backupId}.meta.json`);

  try {
    logger.info({ backupId, databaseUrl: databaseUrl.replace(/\/\/.*@/, "//***@") }, "Starting database backup");

    await runPgDump(databaseUrl, compressedPath);

    const [sizeBytes, checksumSha256] = await Promise.all([
      getFileSize(compressedPath),
      computeSha256(compressedPath),
    ]);

    let location: string;
    const s3Bucket = process.env.BACKUP_S3_BUCKET;

    if (s3Bucket) {
      const remoteKey = `db-backups/${timestamp}_${backupId}.sql.gz`;
      try {
        location = await uploadToS3(compressedPath, remoteKey);
        logger.info({ backupId, location, sizeBytes }, "Backup uploaded to S3");
      } catch (s3Err: any) {
        logger.error({ backupId, err: s3Err.message }, "S3 upload failed, keeping local copy");
        location = compressedPath;
      }
    } else {
      const backupDir = process.env.BACKUP_DIR || "/tmp/db-backups";
      location = compressedPath;
    }

    const meta = {
      backupId,
      timestamp: new Date().toISOString(),
      sizeBytes,
      checksumSha256,
      durationMs: Date.now() - startTime,
      compressed: true,
      location,
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    const durationMs = Date.now() - startTime;
    logger.info({ backupId, sizeBytes, durationMs }, "Database backup completed");

    return {
      success: true,
      backupId,
      location,
      sizeBytes,
      checksumSha256,
      timestamp: meta.timestamp,
      durationMs,
      compressed: true,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const msg = `Backup failed: ${error.message}`;
    logger.error({ backupId, err: error.message, durationMs }, msg);

    return {
      success: false,
      backupId,
      location: "",
      sizeBytes: 0,
      checksumSha256: "",
      timestamp: new Date().toISOString(),
      durationMs,
      compressed: false,
      error: msg,
    };
  } finally {
    cleanupOldBackups().catch((err) =>
      logger.warn({ err: err.message }, "Backup cleanup failed")
    );
  }
}

async function cleanupOldBackups(): Promise<void> {
  const s3Bucket = process.env.BACKUP_S3_BUCKET;
  if (s3Bucket && BACKUP_RETENTION_DAYS > 0) {
    try {
      const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
        await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: BACKUP_S3_REGION });
      const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 86400000);
      let continuationToken: string | undefined;

      do {
        const listResult = await client.send(
          new ListObjectsV2Command({
            Bucket: s3Bucket,
            Prefix: "db-backups/",
            ContinuationToken: continuationToken,
          }),
        );

        const expired = (listResult.Contents || [])
          .filter((obj) => obj.LastModified && obj.LastModified < cutoff)
          .map((obj) => ({ Key: obj.Key! }));

        if (expired.length > 0) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: s3Bucket,
              Delete: { Objects: expired },
            }),
          );
          logger.info({ count: expired.length }, "Expired backups deleted from S3");
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);
    } catch (err: any) {
      logger.warn({ err: err.message }, "S3 backup cleanup encountered an issue");
    }
  }

  try {
    const files = await fs.readdir(BACKUP_DIR);
    const now = Date.now();
    const cutoffMs = BACKUP_RETENTION_DAYS * 86400000;

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > cutoffMs) {
        await fs.unlink(filePath);
      }
    }
  } catch {
    // BACKUP_DIR may not exist yet on first run
  }
}
