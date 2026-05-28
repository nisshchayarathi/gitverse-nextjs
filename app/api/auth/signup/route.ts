import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import {
  getClientIp,
  countAttempts,
  recordAttempt,
} from "@/lib/services/rateLimitService";

const MAX_SIGNUPS = 3;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    const attemptCount = await countAttempts(ip, "SIGNUP", WINDOW_MS);

    if (attemptCount >= MAX_SIGNUPS) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const passwordRegex =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, and a number",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const txResult = await prisma.$transaction(async (tx) => {
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
      await recordAttempt({
        key: ip,
        type: "SIGNUP",
        success: false,
      });

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

    await recordAttempt({
      key: ip,
      type: "SIGNUP",
      success: true,
    });

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