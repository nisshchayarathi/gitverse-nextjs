import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";

/**
 * Handles authenticated password changes and invalidates
 * existing sessions after a successful password update.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { message: "New password is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userDetails) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const passwordHash = userDetails.passwordHash;

    // Existing password users must verify current password
    if (passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { message: "Current password is required" },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        passwordHash
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { message: "Current password is incorrect" },
          { status: 401 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.userId },
        data: {
          passwordHash: hashedPassword,
          passwordChangedAt: new Date(
            Math.floor(Date.now() / 1000) * 1000
          ),
          tokenVersion: {
            increment: 1,
          },
        },
      }),
      prisma.session.deleteMany({
        where: {
          userId: user.userId,
        },
      }),
    ]);

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    console.error(
      "Error changing password:",
      sanitizeError(error)
    );

    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 }
    );
  }
}