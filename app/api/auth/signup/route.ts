import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getNextAuthSecret } from "@/lib/config/env";
import crypto from "crypto";
import { PASSWORD_REGEX } from "@/lib/utils/validators";
import {
  getClientIp,
  countAttempts,
  recordAttempt,
} from "@/lib/services/rateLimitService";

const MAX_SIGNUPS = 3;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  let normalizedEmail = "";
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string" || !name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Email, password, and name must be valid strings" },
        { status: 400 },
      );
    }

    normalizedEmail = email.toLowerCase();

    const attemptCount = await countAttempts(ip, "SIGNUP", WINDOW_MS);

    if (attemptCount >= MAX_SIGNUPS) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 },
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, and a number",
        },
        { status: 400 },
      );
    }

    if (new TextEncoder().encode(password).length > 72) {
      return NextResponse.json(
        { error: "Password must be at most 72 bytes" },
        { status: 400 },
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

      logger.info(
        { email: normalizedEmail, conflictType: txResult.error },
        "Signup attempt failed: Email already exists",
      );

      return NextResponse.json(
        {
          error:
            "Unable to complete registration. Please verify your information and try again.",
          message:
            "Unable to complete registration. Please verify your information and try again.",
        },
        { status: 409 },
      );
    }

    const user = txResult.user;

    await recordAttempt({
      key: ip,
      type: "SIGNUP",
      success: true,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

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
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      logger.info(
        { email: normalizedEmail, err: error },
        "Signup attempt failed: Database unique constraint violation (email already exists)",
      );
      return NextResponse.json(
        {
          error:
            "Unable to complete registration. Please verify your information and try again.",
          message:
            "Unable to complete registration. Please verify your information and try again.",
        },
        { status: 409 },
      );
    }

    const rawIp = getClientIp(request);
    let ipFingerprint = "unknown";
    if (rawIp !== "unknown") {
      const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      if (secret) {
        ipFingerprint = crypto
          .createHmac("sha256", secret)
          .update(rawIp)
          .digest("hex")
          .substring(0, 16);
      }
    }
    logger.error({ err: sanitizeError(error), ipFingerprint }, "Signup error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
