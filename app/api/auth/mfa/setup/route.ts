/**
 * POST /api/auth/mfa/setup
 *
 * Initiates MFA enrollment for the authenticated user.
 *
 * Flow:
 *   1. Generates a new TOTP secret
 *   2. Encrypts it via upsertMfaSecret → encryptToken (AES-256-GCM)
 *   3. Stores the ciphertext (disabled) in MfaConfig
 *   4. Returns the otpauth:// URI for QR code rendering
 *
 * The secret is NOT activated until /api/auth/mfa/verify is called
 * with a valid TOTP token, completing the enrollment handshake.
 *
 * ════════════════════════════════════════════════════════════════════
 * SECURITY WARNING — DO NOT LOG THE RESPONSE BODY
 * ════════════════════════════════════════════════════════════════════
 *
 * This endpoint returns the TOTP secret in plaintext (Base32) in the
 * response body so the client can render a QR code or display the key
 * for manual entry.  If this response is logged anywhere in your
 * infrastructure — middleware, CloudWatch, DataDog, structured-log
 * sinks — the secret is exposed to anyone with log access.
 *
 *   - Ensure your logging middleware explicitly redacts response bodies
 *     for this endpoint (e.g., by URL pattern "/api/auth/mfa/setup").
 *   - Do NOT add `console.log(response)` or similar debug output here.
 *   - After the handshake, the secret is never returned again.
 *
 * The secret is encrypted *before* being written to the database, so
 * the database at-rest threat model is covered.  The in-transit and
 * in-log threats are the remaining attack surface.
 * ════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import {
  generateTOTPSecret,
  buildOtpAuthUri,
  upsertMfaSecret,
  getMfaStatus,
  verifyTOTP,
  disableMfa,
  getDecryptedTotpSecret,
} from "@/lib/mfa";
import { logAuditEvent } from "@/lib/auditLogger";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
} from "@/lib/rateLimiter";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const ip = getClientIp(request);

    // Rate limit MFA setup to prevent abuse
    const rlResult = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: user.userId,
      ip,
      tier: "free",
    });

    if (!rlResult.allowed) {
      await logAuditEvent({
        userId: user.userId,
        action: "RATE_LIMIT_EXCEEDED",
        resource: "User:MFA",
        details: { endpoint: "/api/auth/mfa/setup", ip },
        ipAddress: ip,
      });
      return rateLimitResponse(rlResult);
    }

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

    // Persist the secret (disabled until verified).
    // upsertMfaSecret encrypts the secret before writing.
    await upsertMfaSecret(user.userId, secret);

    await logAuditEvent({
      userId: user.userId,
      action: "MFA_ENABLED",
      resource: "User:MFA",
      details: { stage: "setup_initiated", email: dbUser.email },
      ipAddress: ip,
    });

    // ── ⚠  SECURITY: The plaintext `secret` is included in this response.
    // ── It must NEVER be logged.  See the doc comment at the top of this
    // ── handler for details.  When MFA secret handling is refactored to
    // ── return the secret only on the very first call (not every call),
    // ── this is the block to change.
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

    // Rate limit MFA disable attempts
    const rlResult = await checkRateLimit({
      endpoint: "mfa:setup",
      userId: user.userId,
      ip,
      tier: "free",
    });

    if (!rlResult.allowed) {
      await logAuditEvent({
        userId: user.userId,
        action: "RATE_LIMIT_EXCEEDED",
        resource: "User:MFA",
        details: { endpoint: "/api/auth/mfa/setup", method: "DELETE", ip },
        ipAddress: ip,
      });
      return rateLimitResponse(rlResult);
    }

    const body = await request.json().catch(() => ({}));
    const { token } = body as { token?: string };

    if (!token || !/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "A valid 6-digit TOTP token is required to disable MFA." },
        { status: 400 },
      );
    }

    const status = await getMfaStatus(user.userId);
    if (!status?.isEnabled) {
      return NextResponse.json(
        { error: "MFA is not currently enabled." },
        { status: 409 },
      );
    }

    const secret = await getDecryptedTotpSecret(user.userId);
    if (!secret) {
      return NextResponse.json(
        { error: "MFA configuration is missing." },
        { status: 409 },
      );
    }

    if (!verifyTOTP(secret, token)) {
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
