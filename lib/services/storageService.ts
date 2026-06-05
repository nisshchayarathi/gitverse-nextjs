import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StoredFile {
  url: string;
  filePath: string;
}

function getExtension(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] || "jpg";
}

function buildPublicUrl(userId: number, filename: string): string {
  return `/uploads/avatars/${userId}/${filename}`;
}

export async function storeAvatar(
  buffer: Buffer,
  userId: number,
  mimeType: string,
): Promise<StoredFile> {
  const ext = getExtension(mimeType);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const relativeDir = path.join("avatars", String(userId));
  const destDir = path.join(UPLOAD_BASE_DIR, relativeDir);

  await fs.mkdir(destDir, { recursive: true });
  const filePath = path.join(destDir, filename);
  await fs.writeFile(filePath, buffer);

  logger.info(
    { userId, file: filename, size: buffer.length },
    "Avatar stored on disk",
  );

  return {
    url: buildPublicUrl(userId, filename),
    filePath,
  };
}

export function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^;]*)*;base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType,
  };
}
