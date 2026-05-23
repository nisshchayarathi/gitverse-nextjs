import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendMail, buildPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Token validity window in milliseconds (1 hour). */
const EXPIRY_MS = 60 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * Always returns 200 with a generic message to prevent email enumeration.
 * The reset link is sent by email (or logged to stdout in dev when SMTP is
 * not configured).
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

    const { email } = body as Record<string, unknown>;

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up the user — but do NOT reveal whether the email exists.
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    // Generic success response regardless of whether the user exists.
    const genericOk = NextResponse.json({
      message:
        "If an account with that email exists, a reset link has been sent.",
    });

    if (!user) {
      // Avoid timing attacks: still do a small amount of work.
      await new Promise((r) => setTimeout(r, 50));
      return genericOk;
    }

    // Google-only accounts have no password — silently skip (no reset needed).
    if (!user.passwordHash) {
      return genericOk;
    }

    // Invalidate any existing unused tokens for this user to keep the table clean.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a cryptographically secure random token.
    const rawToken = crypto.randomBytes(32).toString("hex"); // 64-char hex
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Build the reset URL.
    const appUrl =
      process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ??
      "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    const { html, text } = buildPasswordResetEmail(resetUrl, 60);

    await sendMail({
      to: user.email,
      subject: "Reset your GitVerse password",
      html,
      text,
    });

    return genericOk;
  } catch (error: unknown) {
    console.error("Forgot-password error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
