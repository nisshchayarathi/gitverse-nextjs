import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import {
  isRateLimited,
  recordAttempt,
  clearFailedAttempts,
} from "@/lib/services/rateLimitService";

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ALLOWED_DATA_IMAGE_TYPES = [
  "data:image/jpeg",
  "data:image/png",
  "data:image/webp",
  "data:image/gif",
];

const PROFILE_UPDATE_RATE_LIMIT_MAX = 5;
const PROFILE_UPDATE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_CHANGE_RATE_LIMIT_MAX = 3;
const EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isValidAvatarUrl(avatar: string): boolean {
  if (avatar.startsWith("data:")) {
    return ALLOWED_DATA_IMAGE_TYPES.some((type) => avatar.startsWith(type));
  }

  try {
    const parsedUrl = new URL(avatar);

    if (!["http:", "https:", "blob:"].includes(parsedUrl.protocol)) {
      return false;
    }

    if (
      parsedUrl.protocol !== "blob:" &&
      (!parsedUrl.hostname || !parsedUrl.hostname.includes("."))
    ) {
      return false;
    }

    const pathname = parsedUrl.pathname.toLowerCase();

    return ALLOWED_IMAGE_EXTENSIONS.some((extension) =>
      pathname.endsWith(extension)
    );
  } catch {
    return false;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const userIdStr = user.userId.toString();
    if (
      await isRateLimited(
        userIdStr,
        "CHANGE_PASSWORD",
        PROFILE_UPDATE_RATE_LIMIT_MAX,
        PROFILE_UPDATE_RATE_LIMIT_WINDOW_MS
      )
    ) {
      return NextResponse.json(
        { error: "Too many profile update attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 }
      );
    }

    const { name, email, avatar, newPassword, currentPassword } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name must be a non-empty string" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be less than 100 characters" },
        { status: 400 }
      );
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        { error: "Email must be less than 254 characters" },
        { status: 400 }
      );
    }

    if ("avatar" in body && avatar !== undefined && avatar !== null && typeof avatar !== "string") {
      return NextResponse.json(
        { error: "Avatar must be a valid image URL" },
        { status: 400 }
      );
    }

    if (typeof avatar === "string" && avatar && !isValidAvatarUrl(avatar)) {
      return NextResponse.json(
        {
          error:
            "Avatar must be a valid HTTP/HTTPS image URL or supported image data URL",
        },
        { status: 400 }
      );
    }

    if (newPassword !== undefined && newPassword !== null) {
      if (typeof newPassword !== "string") {
        return NextResponse.json(
          { error: "New password must be a string" },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      if (newPassword.length > 128) {
        return NextResponse.json(
          { error: "Password must be less than 128 characters" },
          { status: 400 }
        );
      }
    }

    if (currentPassword !== undefined && currentPassword !== null) {
      if (typeof currentPassword !== "string") {
        return NextResponse.json(
          { error: "Current password must be a string" },
          { status: 400 }
        );
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        id: { not: user.userId },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        email: true,
        passwordHash: true,
        accounts: {
          select: { provider: true },
          where: { provider: "google" },
        },
      },
    });

    if (!current) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isEmailChanging =
      !!current.email &&
      typeof email === "string" &&
      email.toLowerCase() !== current.email.toLowerCase();

    const hasLinkedGoogle = (current.accounts?.length ?? 0) > 0;
    const hasPassword = current.passwordHash !== null;

    if (isEmailChanging) {
      if (
        await isRateLimited(
          userIdStr,
          "CHANGE_PASSWORD",
          EMAIL_CHANGE_RATE_LIMIT_MAX,
          EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Too many email change attempts. Please try again later.",
          },
          { status: 429, headers: { "Retry-After": "3600" } }
        );
      }
    }

    if (isEmailChanging && hasPassword) {
      if (!currentPassword || typeof currentPassword !== "string") {
        await recordAttempt({
          key: userIdStr,
          type: "CHANGE_PASSWORD",
          success: false,
          userId: user.userId,
        });
        return NextResponse.json(
          {
            error:
              "Current password is required to change your email address",
          },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        current.passwordHash!
      );

      if (!isPasswordValid) {
        await recordAttempt({
          key: userIdStr,
          type: "CHANGE_PASSWORD",
          success: false,
          userId: user.userId,
        });
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      await clearFailedAttempts(userIdStr, "CHANGE_PASSWORD");
    }

    if (isEmailChanging && hasLinkedGoogle && !hasPassword) {
      if (!newPassword || typeof newPassword !== "string") {
        return NextResponse.json(
          {
            error:
              "Changing email will unlink your Google account. Please provide a new password to secure your account.",
          },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            "For security, Google-only accounts must re-authenticate with Google before changing email. Please sign in with Google again to verify your identity.",
          code: "REAUTH_REQUIRED",
        },
        { status: 403 }
      );
    }

    if (isEmailChanging && hasLinkedGoogle && hasPassword) {
      if (!newPassword || typeof newPassword !== "string") {
        return NextResponse.json(
          {
            error:
              "Changing email will unlink your Google account. Please provide a new password to set for your account.",
          },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
    }

    const updateData: Prisma.UserUpdateInput = {
      name: name.trim(),
      email: email.toLowerCase(),
    };

    if (isEmailChanging && hasLinkedGoogle) {
      await prisma.account.deleteMany({
        where: { userId: user.userId, provider: "google" },
      });

      if (newPassword && typeof newPassword === "string") {
        updateData.passwordHash = await bcrypt.hash(newPassword, 10);
      }

      updateData.tokenVersion = { increment: 1 };

      await prisma.session.deleteMany({
        where: { userId: user.userId },
      });
    }

    if (avatar) {
      if (typeof avatar !== "string") {
        return NextResponse.json(
          { error: "Invalid avatar format" },
          { status: 400 }
        );
      }

      if (avatar.startsWith("data:")) {
        const mimeTypeMatch = avatar.match(/^data:([^;,]+)[;,]/);

        if (!mimeTypeMatch || !mimeTypeMatch[1].startsWith("image/")) {
          return NextResponse.json(
            { error: "Avatar must be an image data URL" },
            { status: 400 }
          );
        }

        const base64Data = avatar.split(",")[1];

        if (!base64Data) {
          return NextResponse.json(
            { error: "Invalid avatar data URL" },
            { status: 400 }
          );
        }

        const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);

        if (sizeInBytes > 500 * 1024) {
          return NextResponse.json(
            { error: "Avatar image is too large" },
            { status: 413 }
          );
        }

        updateData.image = avatar;
      } else if (avatar.startsWith("http")) {
        updateData.image = avatar;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    if (isEmailChanging) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.userId,
            action: "EMAIL_CHANGED",
            resource: "USER",
            details: {
              previousEmail: current.email,
              newEmail: email.toLowerCase(),
              googleUnlinked: hasLinkedGoogle,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (auditError) {
        logger.error(
          { err: sanitizeError(auditError), route: "app/api/users/profile/route.ts", action: "create-audit-log" },
          "Failed to create audit log"
        );
      }
    }

    return NextResponse.json({
      ...updatedUser,
      avatarUrl: (updatedUser as any).image,
      message: isEmailChanging
        ? "Profile updated. Your Google account has been unlinked. All other sessions have been invalidated."
        : "Profile updated successfully",
    });
  } catch (error: any) {
    logger.error(
      { err: sanitizeError(error), route: "app/api/users/profile/route.ts" },
      "Error updating profile"
    );

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
