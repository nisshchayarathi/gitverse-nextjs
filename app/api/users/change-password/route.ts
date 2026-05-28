import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import {
  isRateLimited,
  recordAttempt,
} from "@/lib/services/rateLimitService";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    const userId = user.userId.toString();

    if (await isRateLimited(userId, "CHANGE_PASSWORD", MAX_ATTEMPTS, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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

    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      passwordHash,
    );

    if (!isPasswordValid) {
      await recordAttempt({
        key: userId,
        type: "CHANGE_PASSWORD",
        success: false,
        userId: user.userId,
      });
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    console.error("Error changing password:", sanitizeError(error));

    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}