/**
 * POST /api/auth/mfa/setup
 *
 * Initiates MFA enrollment for the authenticated user.
 *
 * Flow:
 *   1. Generates a new TOTP secret
 *   2. Stores it (disabled) in MfaConfig
 *   3. Returns the otpauth:// URI for QR code rendering
 *
 * The secret is NOT activated until /api/auth/mfa/verify is called
 * with a valid TOTP token, completing the enrollment handshake.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import {
  generateTOTPSecret,
  buildOtpAuthUri,
  upsertMfaSecret,
  getMfaStatus,
} from "@/lib/mfa";
import { logAuditEvent } from "@/lib/auditLogger";
import { getClientIp } from "@/lib/rateLimiter";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const ip = getClientIp(request);

    // Fetch user email for QR code label
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if MFA is already enabled
    const status = await getMfaStatus(user.userId);
    if (status?.isEnabled) {
      return NextResponse.json(
        {
          error:
            "MFA is already enabled. Disable it first before re-enrolling.",
        },
        { status: 409 },
      );
    }

    // Generate a fresh TOTP secret
    const secret = generateTOTPSecret();
    const otpauthUri = buildOtpAuthUri(secret, dbUser.email);

    // Persist the secret (disabled until verified)
    await upsertMfaSecret(user.userId, secret);

    await logAuditEvent({
      userId: user.userId,
      action: "MFA_ENABLED",
      resource: "User:MFA",
      details: { stage: "setup_initiated", email: dbUser.email },
      ipAddress: ip,
    });

    return NextResponse.json({
      message:
        "Scan the QR code with your authenticator app, then verify with a TOTP token.",
      /** The secret in plain Base32 — for manual entry into authenticator apps */
      secret,
      /** otpauth:// URI — pass to a QR code library on the client */
      otpauthUri,
    });
  } catch (error: any) {
    console.error("[MFA Setup] Error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to initialize MFA setup" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/auth/mfa/setup
 *
 * Disables and removes MFA for the authenticated user.
 * Requires a valid TOTP token in the request body for re-confirmation.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const ip = getClientIp(request);

    const body = await request.json().catch(() => ({}));
    const { token } = body as { token?: string };

    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "A valid 6-digit TOTP token is required to disable MFA." },
        { status: 400 },
      );
    }

    const mfaConfig = await prisma.mfaConfig.findUnique({
      where: { userId: user.userId },
      select: { totpSecret: true, isEnabled: true },
    });

    if (!mfaConfig?.isEnabled) {
      return NextResponse.json(
        { error: "MFA is not currently enabled." },
        { status: 409 },
      );
    }

    // Import verifyTOTP inline to avoid circular deps
    const { verifyTOTP, disableMfa } = await import("@/lib/mfa");

    if (!verifyTOTP(mfaConfig.totpSecret, token)) {
      await logAuditEvent({
        userId: user.userId,
        action: "MFA_FAILED",
        resource: "User:MFA",
        details: { stage: "disable_verification_failed" },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid TOTP token." },
        { status: 401 },
      );
    }

    await disableMfa(user.userId);

    await logAuditEvent({
      userId: user.userId,
      action: "MFA_DISABLED",
      resource: "User:MFA",
      details: { stage: "mfa_disabled" },
      ipAddress: ip,
    });

    return NextResponse.json({
      message: "MFA has been disabled successfully.",
    });
  } catch (error: any) {
    console.error("[MFA Disable] Error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 },
    );
  }
}
