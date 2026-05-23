import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/reset-password
 *
 * Body: { token: string; password: string }
 *
 * Verifies the reset token, checks expiry and single-use, then updates the
 * user's password and marks the token as used.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { token, password } = body as Record<string, unknown>;

    // --- Validate inputs ---
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: "Reset token is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    // --- Look up the hashed token ---
    const tokenHash = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    // Use a generic message to avoid leaking whether a token ever existed.
    const invalidTokenResponse = NextResponse.json(
      { error: "This reset link is invalid or has expired" },
      { status: 400 }
    );

    if (!record) {
      return invalidTokenResponse;
    }

    // Already used — single-use enforcement.
    if (record.usedAt !== null) {
      return invalidTokenResponse;
    }

    // Expired.
    if (record.expiresAt < new Date()) {
      return invalidTokenResponse;
    }

    // --- Update password and invalidate token atomically ---
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const passwordWasReset = await prisma.$transaction(async (tx) => {
      const consumedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumedToken.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      return true;
    });

    if (!passwordWasReset) {
      return invalidTokenResponse;
    }

    return NextResponse.json({
      message: "Password updated successfully. You can now sign in.",
    });
  } catch (error: unknown) {
    console.error("Reset-password error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
