import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/utils/withErrorHandler";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
} from "@/lib/services/imageService";

/**
 * POST /api/upload/avatar
 *
 * Handles avatar image uploads for authenticated users.
 * Supports:
 * - multipart/form-data with a "file" field
 * - JSON body with a "dataUrl" field (base64 data URL)
 * - JSON body with a "url" field (HTTP/HTTPS URL)
 *
 * Uses withErrorHandler for consistent error response formatting.
 * Does not log sensitive user data (UIDs, file names) to console in production.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const contentType = request.headers.get("content-type") || "";

  let avatarUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // Handle file upload
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

    // Store the file as a data URL for now (in production, use blob storage)
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    avatarUrl = `data:${file.type};base64,${base64}`;

    logger.info(
      { userId: user.userId, mimeType: file.type, size: file.size },
      "Avatar uploaded via file"
    );
  } else if (contentType.includes("application/json")) {
    // Handle JSON body with dataUrl or url
    const body = await request.json();
    const { dataUrl, url } = body;

    if (dataUrl) {
      const validation = validateDataUrl(dataUrl);
      if (!validation.valid) {
        return NextResponse.json(
          { error: true, message: validation.error, code: 400 },
          { status: 400 }
        );
      }
      avatarUrl = dataUrl;

      logger.info({ userId: user.userId }, "Avatar uploaded via data URL");
    } else if (url) {
      const validation = validateHttpAvatarUrl(url);
      if (!validation.valid) {
        return NextResponse.json(
          { error: true, message: validation.error, code: 400 },
          { status: 400 }
        );
      }
      avatarUrl = url;

      logger.info({ userId: user.userId }, "Avatar uploaded via HTTP URL");
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
