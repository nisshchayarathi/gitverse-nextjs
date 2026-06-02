import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import {
  isRateLimited,
  recordAttempt,
} from "@/lib/services/rateLimitService";
import { RedactSensitiveFields } from "@/services/security/redact-sensitive-fields";

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    const hasGoogleAccount =
      (await prisma.account.count({
        where: { userId: user.userId, provider: "google" },
      })) > 0;

    if (!userDetails) {
      return NextResponse.json(
        { error: "User not found" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        },
      );
    }

    return NextResponse.json(
      RedactSensitiveFields.redact({
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
        image: userDetails.image,
        createdAt: userDetails.createdAt,
        avatarUrl: (userDetails as any).image,
        isGoogleLinked: hasGoogleAccount,
        hasPassword: userDetails.passwordHash !== null,
      }),
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  } catch (error: any) {
    console.error("Error fetching user:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to fetch user" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userId = user.userId.toString();

    if (await isRateLimited(userId, "DELETE_ACCOUNT", MAX_ATTEMPTS, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    let password: string | undefined;
    try {
      const body = await request.json();
      password = body.password;
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 },
      );
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { passwordHash: true },
    });

    if (!fullUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    if (fullUser.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password is required to delete your account" },
          { status: 400 },
        );
      }

      const isValid = await bcrypt.compare(password, fullUser.passwordHash);
      if (!isValid) {
        await recordAttempt({
          key: userId,
          type: "DELETE_ACCOUNT",
          success: false,
          userId: user.userId,
        });
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 401 },
        );
      }
    }

    await prisma.$transaction([
      prisma.gitHubRepo.deleteMany({ where: { userId: user.userId } }),
      prisma.gitHubAccount.deleteMany({ where: { userId: user.userId } }),
      prisma.user.delete({ where: { id: user.userId } }),
    ]);

    return NextResponse.json(
      { message: "Account deleted" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  } catch (error: any) {
    console.error("Error deleting account:", sanitizeError(error));

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete account" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  }
}
