import fs from "fs/promises";
import path from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { createWriteStream } from "fs";

const mockExecAsync = jest.fn();
jest.mock("util", () => ({
  promisify: () => mockExecAsync,
}));
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockS3Client = {
  send: jest.fn(),
};
const mockPutObjectCommand = jest.fn();
const mockListObjectsV2Command = jest.fn();
const mockDeleteObjectsCommand = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn((args) => {
    mockPutObjectCommand(args);
    return { type: "PutObjectCommand", ...args };
  }),
  ListObjectsV2Command: jest.fn((args) => {
    mockListObjectsV2Command(args);
    return { type: "ListObjectsV2Command", ...args };
  }),
  DeleteObjectsCommand: jest.fn((args) => {
    mockDeleteObjectsCommand(args);
    return { type: "DeleteObjectsCommand", ...args };
  }),
}));

const BACKUP_DIR = "/tmp/test-backups";
const TEST_DB_URL = "postgresql://user:pass@localhost:5432/testdb";

const ORIGINAL_ENV = { ...process.env };

async function createGzipFile(filePath: string, content: string): Promise<void> {
  const gzip = createGzip();
  await pipeline(Readable.from([Buffer.from(content, "utf-8")]), gzip, createWriteStream(filePath));
}

describe("backupService", () => {
  let backupService: typeof import("../services/backupService");

  beforeAll(() => {
    process.env.BACKUP_DIR = BACKUP_DIR;
    process.env.BACKUP_DATABASE_URL = TEST_DB_URL;
    process.env.BACKUP_RETENTION_DAYS = "1";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    for (const f of files) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
    backupService = require("../services/backupService");
  });

  afterEach(async () => {
    await fs.rm(BACKUP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe("handleBackup", () => {
    it("returns failure when no DATABASE_URL is configured", async () => {
      delete process.env.BACKUP_DATABASE_URL;
      delete process.env.DATABASE_URL;

      const result = await backupService.handleBackup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("DATABASE_URL");

      process.env.BACKUP_DATABASE_URL = TEST_DB_URL;
    });

    it("runs pg_dump via exec and writes a compressed file", async () => {
      const content = "CREATE TABLE test (id int);\n";
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), content).then(() => ({ stdout: content, stderr: "" }));
        return Promise.resolve({ stdout: content, stderr: "" });
      });

      const result = await backupService.handleBackup();
      expect(result.success).toBe(true);
      expect(result.backupId).toMatch(/^backup-/);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.compressed).toBe(true);
    });

    it("writes a metadata JSON file alongside the backup", async () => {
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });

      const result = await backupService.handleBackup();
      const metaPath = path.join(BACKUP_DIR, `${result.backupId}.meta.json`);
      const meta = await fs.readFile(metaPath, "utf-8");
      const metaJson = JSON.parse(meta);

      expect(metaJson.backupId).toBe(result.backupId);
      expect(metaJson.sizeBytes).toBe(result.sizeBytes);
      expect(metaJson.checksumSha256).toBe(result.checksumSha256);
    });

    it("falls back to local storage when S3 bucket is not configured", async () => {
      delete process.env.BACKUP_S3_BUCKET;
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });

      const result = await backupService.handleBackup();
      expect(result.success).toBe(true);
      expect(result.location).not.toContain("s3://");
    });

    it("uploads to S3 when BACKUP_S3_BUCKET is set", async () => {
      process.env.BACKUP_S3_BUCKET = "test-backup-bucket";
      process.env.BACKUP_S3_REGION = "us-east-1";
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });
      mockS3Client.send.mockResolvedValue({});

      const result = await backupService.handleBackup();
      expect(result.success).toBe(true);
      expect(result.location).toContain("s3://test-backup-bucket");

      delete process.env.BACKUP_S3_BUCKET;
      delete process.env.BACKUP_S3_REGION;
    });

    it("logs and recovers when S3 upload fails", async () => {
      process.env.BACKUP_S3_BUCKET = "failing-bucket";
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });
      mockS3Client.send.mockRejectedValue(new Error("S3 error"));

      const result = await backupService.handleBackup();
      expect(result.success).toBe(true);
      expect(result.location).not.toContain("s3://");

      delete process.env.BACKUP_S3_BUCKET;
    });

    it("returns failure when pg_dump errors", async () => {
      mockExecAsync.mockRejectedValue(new Error("pg_dump: connection to server failed"));

      const result = await backupService.handleBackup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("pg_dump: connection");
    });

    it("generates unique backup IDs with timestamp and random suffix", async () => {
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });

      const r1 = await backupService.handleBackup();
      const r2 = await backupService.handleBackup();

      expect(r1.backupId).not.toBe(r2.backupId);
      expect(r1.backupId).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-f0-9]{8}$/);
    });

    it("sets a meaningful location path", async () => {
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });

      const result = await backupService.handleBackup();
      expect(result.location).toBeTruthy();
      expect(result.location.replace(/\\/g, "/")).toContain(BACKUP_DIR.replace(/\\/g, "/"));
    });

    it("reports zero sizeBytes on failure", async () => {
      mockExecAsync.mockRejectedValue(new Error("failure"));

      const result = await backupService.handleBackup();
      expect(result.success).toBe(false);
      expect(result.sizeBytes).toBe(0);
    });

    it("cleanupOldBackups does not throw on empty backup dir", async () => {
      mockExecAsync.mockImplementation((cmd: string) => {
        const m = cmd.match(/(backup-.+?)\.sql/);
        if (m) return createGzipFile(path.join(BACKUP_DIR, `${m[1]}.sql.gz`), "data").then(() => ({ stdout: "data", stderr: "" }));
        return Promise.resolve({ stdout: "data", stderr: "" });
      });
      const result = await backupService.handleBackup();
      expect(result.success).toBe(true);
    });
  });
});
