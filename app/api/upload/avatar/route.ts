import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/utils/withErrorHandler";
import { requireAuth } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
  fetchAndValidateAvatarUrl,
  validateImageContent,
} from "@/lib/services/imageService";
import { storeAvatar, parseDataUrl } from "@/lib/services/storageService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

/**
 * POST /api/upload/avatar
 *
 * Handles avatar image uploads for authenticated users.
 * Supports:
 * - multipart/form-data with a "file" field
 * - JSON body with a "dataUrl" field (base64 data URL)
 * - JSON body with a "url" field (HTTP/HTTPS URL)
 *
 * Images are stored on disk. The database stores only the URL reference,
 * not the raw image data. Run `git checkout public/uploads/` from .gitignore
 * to exclude uploaded files from version control.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.AVATAR_UPLOAD);
  if (!rl.allowed) return rateLimitResponse(rl);

  const contentType = request.headers.get("content-type") || "";

  let avatarUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: true, message: "No file provided", code: 400 },
        { status: 400 }
      );
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: true, message: validation.error, code: 400 },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeAvatar(buffer, user.userId, file.type);
    avatarUrl = stored.url;

    logger.info(
      { userId: user.userId, mimeType: file.type, size: file.size },
      "Avatar uploaded via file"
    );
  } else if (contentType.includes("application/json")) {
    const body = await request.json();
    const { dataUrl, url } = body;

    if (dataUrl) {
      const validation = await validateDataUrl(dataUrl);
      if (!validation.valid) {
        return NextResponse.json(
          { error: true, message: validation.error, code: 400 },
          { status: 400 }
        );
      }

      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: true, message: "Failed to parse data URL", code: 400 },
          { status: 400 }
        );
      }

      const contentCheck = await validateImageContent(parsed.buffer);
      if (!contentCheck.valid) {
        return NextResponse.json(
          { error: true, message: contentCheck.error, code: 400 },
          { status: 400 }
        );
      }

      const stored = await storeAvatar(parsed.buffer, user.userId, contentCheck.mimeType || parsed.mimeType);
      avatarUrl = stored.url;

      logger.info({ userId: user.userId }, "Avatar uploaded via data URL");
    } else if (url) {
      const validation = await validateHttpAvatarUrl(url);
      if (!validation.valid) {
        return NextResponse.json(
          { error: true, message: validation.error, code: 400 },
          { status: 400 }
        );
      }

      const fetched = await fetchAndValidateAvatarUrl(url);
      if (!fetched.valid || !fetched.fetched) {
        return NextResponse.json(
          { error: true, message: fetched.error || "Failed to fetch avatar", code: 400 },
          { status: 400 }
        );
      }

      const stored = await storeAvatar(fetched.fetched.buffer, user.userId, fetched.fetched.mimeType);
      avatarUrl = stored.url;

      logger.info(
        { userId: user.userId, originalUrl: url, mimeType: fetched.fetched.mimeType, size: fetched.fetched.buffer.length },
        "Avatar uploaded via HTTP URL with server-side fetch",
      );
    } else {
      return NextResponse.json(
        {
          error: true,
          message: "Either 'dataUrl' or 'url' must be provided",
          code: 400,
        },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      {
        error: true,
        message: "Unsupported content type. Use multipart/form-data or application/json",
        code: 415,
      },
      { status: 415 }
    );
  }

  if (!avatarUrl) {
    return NextResponse.json(
      { error: true, message: "Failed to process avatar", code: 500 },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      avatarUrl,
      message: "Avatar uploaded successfully",
    },
    { status: 200 }
  );
});
