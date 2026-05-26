import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const signupAttempts = new Map<string, { count: number; resetTime: number }>();

const MAX_SIGNUPS = 3;
const WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const record = signupAttempts.get(ip);

  if (!record || now > record.resetTime) {
    signupAttempts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_SIGNUPS) {
    return true;
  }

  record.count += 1;
  signupAttempts.set(ip, record);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const txResult = await prisma.$transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        const isGoogleOnly =
          !existingUser.passwordHash &&
          (await tx.account.count({
            where: { userId: existingUser.id, provider: "google" },
          })) > 0;

        return { error: isGoogleOnly ? "GOOGLE_ONLY" : "USER_EXISTS" };
      }

      // Create user
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: hashedPassword,
          name,
        },
      });

      return { user: createdUser };
    });

    if ("error" in txResult) {
      if (txResult.error === "GOOGLE_ONLY") {
        return NextResponse.json(
          { error: "Email already exists. Please sign in with Google." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const user = txResult.user;

    const token = generateToken({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: (user as any).image,
        },
        token,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const rawIp = getClientIp(request);
    let ipFingerprint = "unknown";
    if (rawIp !== "unknown") {
      const secret = process.env.NEXTAUTH_SECRET || "fallback_secret";
      ipFingerprint = crypto.createHmac("sha256", secret).update(rawIp).digest("hex").substring(0, 16);
    }
    logger.error({ err: sanitizeError(error), ipFingerprint }, "Signup error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}