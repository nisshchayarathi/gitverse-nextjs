/**
 * POST /api/auth/mfa/verify
 *
 * Verifies a TOTP token for the authenticated user.
 *
 * Two modes:
 *   1. **Enrollment** (`mode: "enroll"`): Activates MFA after the user scans
 *      the QR code from /api/auth/mfa/setup. Also generates and returns backup codes.
 *
 *   2. **Authentication** (`mode: "authenticate"`): Validates an MFA token
 *      during login (second factor check). Returns success/failure.
 *
 * Request body:
 *   { token: string, mode: "enroll" | "authenticate" }
 *
 * Backup code verification:
 *   Send `{ backupCode: string }` instead of `token` to use a backup code.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";
import {
  verifyTOTP,
  enableMfa,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
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

    // Apply strict rate limiting on MFA verification to prevent brute-force
    const rlResult = await checkRateLimit({
      endpoint: "ai:analyze-repository", // reuse the strictest quota as sentinel
      userId: user.userId,
      ip,
      tier: "free",
    });

    if (!rlResult.allowed) {
      await logAuditEvent({
        userId: user.userId,
        action: "RATE_LIMIT_EXCEEDED",
        resource: "User:MFA",
        details: { endpoint: "/api/auth/mfa/verify", ip },
        ipAddress: ip,
      });
      return rateLimitResponse(rlResult);
    }

    const body = await request.json().catch(() => ({}));
    const {
      token,
      backupCode,
      mode = "authenticate",
    } = body as {
      token?: string;
      backupCode?: string;
      mode?: "enroll" | "authenticate";
    };

    if (!token && !backupCode) {
      return NextResponse.json(
        { error: "Either a TOTP token or a backup code is required." },
        { status: 400 },
      );
    }

    // Fetch MFA config
    const mfaConfig = await prisma.mfaConfig.findUnique({
      where: { userId: user.userId },
      select: { totpSecret: true, isEnabled: true },
    });

    if (!mfaConfig?.totpSecret) {
      return NextResponse.json(
        { error: "MFA not initialized. Call /api/auth/mfa/setup first." },
        { status: 409 },
      );
    }

    // ── Backup Code Path ───────────────────────────────────────────────────
    if (backupCode) {
      if (!mfaConfig.isEnabled) {
        return NextResponse.json(
          { error: "MFA must be enabled before using backup codes." },
          { status: 409 },
        );
      }

      const consumed = await verifyAndConsumeBackupCode(
        user.userId,
        backupCode,
      );

      if (!consumed) {
        await logAuditEvent({
          userId: user.userId,
          action: "MFA_FAILED",
          resource: "User:MFA",
          details: { method: "backup_code", stage: "invalid_or_used" },
          ipAddress: ip,
        });
        return NextResponse.json(
          { error: "Invalid or already-used backup code." },
          { status: 401 },
        );
      }

      await logAuditEvent({
        userId: user.userId,
        action: "MFA_VERIFIED",
        resource: "User:MFA",
        details: { method: "backup_code" },
        ipAddress: ip,
      });

      return NextResponse.json({ verified: true, method: "backup_code" });
    }

    // ── TOTP Token Path ────────────────────────────────────────────────────
    if (!/^\d{6}$/.test(token!)) {
      return NextResponse.json(
        { error: "Token must be a 6-digit numeric code." },
        { status: 400 },
      );
    }

    const isValid = verifyTOTP(mfaConfig.totpSecret, token!);

    if (!isValid) {
      await logAuditEvent({
        userId: user.userId,
        action: "MFA_FAILED",
        resource: "User:MFA",
        details: { method: "totp", mode },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid or expired TOTP token." },
        { status: 401 },
      );
    }

    // ── Enrollment Activation ──────────────────────────────────────────────
    if (mode === "enroll") {
      if (mfaConfig.isEnabled) {
        return NextResponse.json(
          { error: "MFA is already enrolled and active." },
          { status: 409 },
        );
      }

      const { plaintext: backupCodes, hashed } = generateBackupCodes();
      await enableMfa(user.userId, hashed);

      await logAuditEvent({
        userId: user.userId,
        action: "MFA_ENABLED",
        resource: "User:MFA",
        details: { stage: "enrollment_complete", method: "totp" },
        ipAddress: ip,
      });

      return NextResponse.json({
        verified: true,
        enrolled: true,
        message:
          "MFA has been activated. Save these backup codes in a safe place — they will not be shown again.",
        /**
         * Backup codes: shown ONCE to the user. Each is valid for a single use.
         * Client should present these prominently (e.g., download button).
         */
        backupCodes,
      });
    }

    // ── Authentication Verification ────────────────────────────────────────
    if (!mfaConfig.isEnabled) {
      return NextResponse.json(
        { error: "MFA is not enabled for this account." },
        { status: 409 },
      );
    }

    // Update last verified timestamp
    await prisma.mfaConfig.update({
      where: { userId: user.userId },
      data: { lastVerifiedAt: new Date() },
    });

    await logAuditEvent({
      userId: user.userId,
      action: "MFA_VERIFIED",
      resource: "User:MFA",
      details: { method: "totp", mode: "authenticate" },
      ipAddress: ip,
    });

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error("[MFA Verify] Error:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "MFA verification failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/mfa/verify
 *
 * Returns the current MFA status for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const mfaConfig = await prisma.mfaConfig.findUnique({
      where: { userId: user.userId },
      select: { isEnabled: true, lastVerifiedAt: true, createdAt: true },
    });

    return NextResponse.json({
      mfaEnabled: mfaConfig?.isEnabled ?? false,
      lastVerifiedAt: mfaConfig?.lastVerifiedAt ?? null,
      enrolledAt: mfaConfig?.createdAt ?? null,
    });
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch MFA status" },
      { status: 500 },
    );
  }
}
