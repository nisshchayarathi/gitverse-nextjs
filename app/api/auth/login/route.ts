import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

function getClientIp(request: NextRequest) {
  return request.ip ?? "unknown";
}

function isRateLimited(ip: string) {
  const record = loginAttempts.get(ip);

  return (
    !!record &&
    Date.now() < record.resetTime &&
    record.count >= MAX_ATTEMPTS
  );
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });
    return;
  }

  record.count += 1;
  loginAttempts.set(ip, record);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
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

    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return apiError(400, "Email and password are required");
    }

    // Normalize email after validation
    const normalizedEmail = email.toLowerCase();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return apiError(401, "Invalid email or password");
    }

    // Prevent password login for Google-only accounts
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
  return apiError(401, "Invalid email or password");
}

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