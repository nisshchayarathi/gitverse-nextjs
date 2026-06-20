import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import {
  getClientIp,
  isRateLimited,
  recordAttempt,
  clearFailedAttempts,
} from "@/lib/services/rateLimitService";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

// Pre-computed dummy hash for timing-safe comparison.
// Generated via bcrypt.hashSync("dummy", 10) - must be exactly 60 characters.
const DUMMY_BCRYPT_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqZR2r0Y2ILi7z1tPzC6mXi7TE7.K";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const { email, password, rememberMe } = body;

    if (!email || !password) {
      return apiError(400, "Email and password are required");
    }

    const normalizedEmail = email.toLowerCase();

    if (await isRateLimited(ip, "LOGIN", MAX_ATTEMPTS, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    if (
      await isRateLimited(normalizedEmail, "LOGIN", MAX_ATTEMPTS, WINDOW_MS)
    ) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    const LOCKOUT_THRESHOLD = 10;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // To prevent timing attacks, always run bcrypt.compare with a dummy hash if user/hash is missing.
    const passwordHashToCompare = user?.passwordHash || DUMMY_BCRYPT_HASH;
    const isValidPassword = await bcrypt.compare(
      password,
      passwordHashToCompare,
    );

    if (!user || !user.passwordHash || !isValidPassword) {
      if (!user) {
        logger.info({ email: normalizedEmail }, "Login failed: User not found");
      } else if (!user.passwordHash) {
        const googleAccountsCount = await prisma.account.count({
          where: { userId: user.id, provider: "google" },
        });
        logger.info(
          { email: normalizedEmail, hasGoogleAccount: googleAccountsCount > 0 },
          "Login failed: User exists but has no password hash (OAuth-only/Google-only)",
        );
      } else {
        logger.info(
          { email: normalizedEmail },
          "Login failed: Incorrect password",
        );
      }

      if (user && user.passwordHash) {
        const newFailedCount = (user.failedLoginAttempts ?? 0) + 1;
        const shouldLock = newFailedCount >= LOCKOUT_THRESHOLD;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedCount,
            lastFailedAttemptAt: new Date(),
            ...(shouldLock
              ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
              : {}),
          },
        });

        await recordAttempt({
          key: ip,
          type: "LOGIN",
          success: false,
          email: normalizedEmail,
        });
        await recordAttempt({
          key: normalizedEmail,
          type: "LOGIN",
          success: false,
        });
      } else {
        await recordAttempt({
          key: ip,
          type: "LOGIN",
          success: false,
          email: normalizedEmail,
        });
      }

      return apiError(401, "Invalid email or password");
    }

    // Now user identity is verified.
    // Check if the account is temporarily locked.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.info(
        { email: normalizedEmail },
        "Login blocked: Account is locked",
      );
      return NextResponse.json(
        {
          error:
            "Account is temporarily locked due to too many failed attempts. Please try again later.",
        },
        {
          status: 423,
          headers: {
            "Retry-After": String(
              Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000),
            ),
          },
        },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedAttemptAt: null,
      },
    });

    await recordAttempt({
      key: ip,
      type: "LOGIN",
      success: true,
      email: normalizedEmail,
    });
    await clearFailedAttempts(normalizedEmail, "LOGIN");

    const token = generateToken(
      {
        userId: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion,
      },
      {
        expiresIn: rememberMe ? "30d" : "1d",
      }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: (user as any).image,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return apiError(500, "Internal server error");
  }
}
