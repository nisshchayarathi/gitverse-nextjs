import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import bcrypt from "bcryptjs";

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ALLOWED_DATA_IMAGE_TYPES = [
  "data:image/jpeg",
  "data:image/png",
  "data:image/webp",
  "data:image/gif",
];

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

/**
 * PUT /api/users/profile
 *
 * Updates the profile details (name, email, avatar, and optional password) of the authenticated user.
 * If the user's email is changing and they have a linked Google account, their Google account is
 * securely unlinked, and they must provide a new password. Both the Google account unlinking
 * and user profile update are performed atomically in a single Prisma transaction.
 *
 * @param request - The incoming HTTP NextRequest containing updated profile fields.
 * @returns A JSON response with the updated User details and status code 200, or a 400/401/500 error response.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, email, avatar, newPassword } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 },
      );
    }

    if (typeof name !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { error: "Name and email must be strings" },
        { status: 400 },
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

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.userId },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 400 },
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        email: true,
        accounts: { select: { provider: true }, where: { provider: "google" } },
      },
    });

    const isEmailChanging =
      !!current?.email &&
      typeof email === "string" &&
      email.toLowerCase() !== current.email.toLowerCase();

    const hasLinkedGoogle = (current?.accounts?.length ?? 0) > 0;

    if (isEmailChanging && hasLinkedGoogle) {
      if (!newPassword || typeof newPassword !== "string") {
        return NextResponse.json(
          {
            error:
              "Changing email will unlink your Google account. Please provide newPassword to set a new password.",
          },
          { status: 400 },
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
    }

    const updateData: Prisma.UserUpdateInput = { name, email };

    if (isEmailChanging && hasLinkedGoogle) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
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

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (isEmailChanging && hasLinkedGoogle) {
        // Unlink Google account atomically within the transaction
        await tx.account.deleteMany({
          where: { userId: user.userId, provider: "google" },
        });
      }

      return await tx.user.update({
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
    });

    return NextResponse.json({
      ...updatedUser,
      avatarUrl: updatedUser.image,
    });
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error updating profile:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}