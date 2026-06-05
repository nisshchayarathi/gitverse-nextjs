import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import {
  getClientIp,
  isRateLimited,
  recordAttempt,
  clearFailedAttempts,
} from "@/lib/services/rateLimitService";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const { email, password } = body;

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
        }
      );
    }

    if (await isRateLimited(normalizedEmail, "LOGIN", MAX_ATTEMPTS, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return apiError(401, "Invalid email or password");
    }

    const LOCKOUT_THRESHOLD = 10;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error:
            "Account is temporarily locked due to too many failed attempts. Please try again later.",
        },
        {
          status: 423,
          headers: {
            "Retry-After": String(
              Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    if (!user.passwordHash) {
      const hasGoogleAccount =
        (await prisma.account.count({
          where: {
            userId: user.id,
            provider: "google",
          },
        })) > 0;

      if (hasGoogleAccount) {
        return apiError(
          401,
          "Email already exists. Please sign in with Google."
        );
      }
    }

    const passwordHash = user.passwordHash;

    if (!passwordHash) {
      return apiError(401, "Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);

    if (!isValidPassword) {
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
      return apiError(401, "Invalid email or password");
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

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

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