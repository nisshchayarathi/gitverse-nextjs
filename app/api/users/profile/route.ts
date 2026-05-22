import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isHttpError } from "@/lib/middleware";
import bcrypt from "bcryptjs";

interface ProfileUpdateData {
  name: string;
  email: string;
  image?: string;
  passwordHash?: string;
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
        { message: "Name and email are required" },
        { status: 400 },
      );
    }

    if (typeof name !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { message: "Name and email must be strings" },
        { status: 400 },
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
        { message: "Email is already in use" },
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
            message:
              "Changing email will unlink your Google account. Please provide newPassword to set a new password.",
          },
          { status: 400 },
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { message: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }
    }

    const updateData: ProfileUpdateData = { name, email };

    if (isEmailChanging && hasLinkedGoogle) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (typeof avatar === "string" && (avatar.startsWith("data:") || avatar.startsWith("http"))) {
      updateData.image = avatar;
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
        { message: error.message },
        { status: error.status },
      );
    }

    console.error("Error updating profile:", error);
    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500 },
    );
  }
}
