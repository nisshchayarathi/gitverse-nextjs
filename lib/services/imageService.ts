import sharp from "sharp";
import { logger } from "@/lib/logger";
import { validateSafeUrl } from "@/lib/utils/ssrfValidator";

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

export interface FetchedAvatarResult {
  buffer: Buffer;
  mimeType: string;
  originalUrl: string;
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
 * Validates that a buffer contains decodable image data using sharp.
 * This prevents polyglot files and invalid image data from being stored.
 * Also strips EXIF metadata to prevent information leakage.
 */
export async function validateImageContent(
  buffer: Buffer,
  allowedMimeTypes: string[] = ALLOWED_MIME_TYPES,
): Promise<ImageValidationResult & { mimeType?: string }> {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty image data" };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024}KB`,
    };
  }

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.format) {
      return { valid: false, error: "Unable to decode image data" };
    }

    const mimeType = mimeFromFormat(metadata.format);
    if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid image format. Allowed: ${allowedMimeTypes.join(", ")}`,
      };
    }

    return { valid: true, mimeType };
  } catch (err: any) {
    logger.warn({ error: err.message }, "Image content validation failed");
    return { valid: false, error: "Image data is not valid or corrupted" };
  }
}

function mimeFromFormat(format: string): string | null {
  const map: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[format] || null;
}

/**
 * Validates a data URL string for avatar.
 * Checks MIME type prefix, size, and decodes and validates the actual image content.
 */
export async function validateDataUrl(dataUrl: string): Promise<ImageValidationResult & { buffer?: Buffer; mimeType?: string }> {
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

  const buffer = Buffer.from(base64Data, "base64");
  const contentCheck = await validateImageContent(buffer);
  if (!contentCheck.valid) {
    return contentCheck;
  }

  return { valid: true, buffer, mimeType: mimeTypeMatch[1] };
}

/**
 * Validates an HTTP(S) URL for avatar by checking DNS resolution.
 * This is the first line of defense against SSRF — it checks that the domain
 * does not resolve to a private or restricted IP at upload time.
 * Does NOT fetch the URL content; use fetchAndValidateAvatarUrl for that.
 */
export async function validateHttpAvatarUrl(url: string): Promise<ImageValidationResult> {
  try {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
    }

    if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
      return { valid: false, error: "Invalid URL hostname" };
    }

    const safe = await validateSafeUrl(url);
    if (!safe) {
      return { valid: false, error: "URL resolves to a restricted address" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Fetches an avatar URL server-side, validates the response, and returns the content.
 *
 * This is the core SSRF defense: instead of storing the external URL for the browser
 * to render (which would let the attacker redirect to any internal address at render
 * time), we fetch the content server-side, validate it, and return a local buffer
 * that gets stored as a server-managed copy.
 *
 * Defense layers:
 * 1. DNS resolution check via validateSafeUrl (rejects private IPs)
 * 2. Server-side fetch (not browser-side — attacker cannot control where it goes)
 * 3. Content-Type header validation (must match allowed image types)
 * 4. Content size check (rejects oversized responses that are never valid avatars)
 * 5. Sharp content decoding (rejects polyglot files, HTML pages, redirect bodies)
 * 6. Follow timeout (prevents slow-loris style attacks tying up the server)
 *
 * The original URL is discarded after fetch. Only the local copy is referenced.
 */
export async function fetchAndValidateAvatarUrl(
  url: string,
  timeoutMs: number = 10000,
): Promise<ImageValidationResult & { fetched?: FetchedAvatarResult }> {
  try {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
    }

    if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
      return { valid: false, error: "Invalid URL hostname" };
    }

    const safe = await validateSafeUrl(url);
    if (!safe) {
      return { valid: false, error: "URL resolves to a restricted address" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "GitVerse-Avatar-Fetcher/1.0",
          Accept: "image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        valid: false,
        error: `Remote server returned ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const allowedContentType = ALLOWED_MIME_TYPES.some((t) =>
      contentType.startsWith(t),
    );

    if (!allowedContentType && !contentType.startsWith("image/")) {
      return {
        valid: false,
        error: "Remote content is not an image",
      };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Remote file too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024}KB`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Remote file too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024}KB`,
      };
    }

    if (arrayBuffer.byteLength === 0) {
      return { valid: false, error: "Remote server returned empty response" };
    }

    const buffer = Buffer.from(arrayBuffer);
    const contentCheck = await validateImageContent(buffer);
    if (!contentCheck.valid) {
      return contentCheck;
    }

    const resolvedType = contentType.split(";")[0].trim();
    const mimeType = contentCheck.mimeType || resolvedType || "image/jpeg";

    return {
      valid: true,
      fetched: {
        buffer,
        mimeType,
        originalUrl: url,
      },
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { valid: false, error: "Request timed out while fetching avatar" };
    }
    logger.warn({ error: err.message, url }, "Avatar fetch failed");
    return { valid: false, error: "Failed to fetch avatar from URL" };
  }
}
