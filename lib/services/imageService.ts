import { logger } from "@/lib/logger";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an image file for avatar upload.
 * Checks MIME type and file size.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    logger.warn({ mimeType: file.type }, "Invalid image MIME type");
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    logger.warn({ size: file.size }, "Image file too large");
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024}KB`,
    };
  }

  return { valid: true };
}

/**
 * Extracts a Buffer from a File object.
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates a unique filename for avatar storage.
 */
export function generateAvatarFilename(userId: number, originalName: string): string {
  const parts = originalName.split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "jpg";
  const timestamp = Date.now();
  return `avatars/${userId}/${timestamp}.${extension}`;
}

/**
 * Validates a data URL string for avatar.
 */
export function validateDataUrl(dataUrl: string): ImageValidationResult {
  if (!dataUrl.startsWith("data:")) {
    return { valid: false, error: "Invalid data URL format" };
  }

  const mimeTypeMatch = dataUrl.match(/^data:([^;,]+)[;,]/);
  if (!mimeTypeMatch || !ALLOWED_MIME_TYPES.includes(mimeTypeMatch[1])) {
    return { valid: false, error: "Invalid image type in data URL" };
  }

  const base64Data = dataUrl.split(",")[1];
  if (!base64Data) {
    return { valid: false, error: "Invalid data URL: no base64 data" };
  }

  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024}KB`,
    };
  }

  return { valid: true };
}

/**
 * Validates an HTTP(S) URL for avatar.
 */
export function validateHttpAvatarUrl(url: string): ImageValidationResult {
  try {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
    }

    if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
      return { valid: false, error: "Invalid URL hostname" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}
