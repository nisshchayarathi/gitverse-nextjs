import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import {
  isRateLimited,
  recordAttempt,
} from "@/lib/services/rateLimitService";

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/users/me
 *
 * Retrieves the profile information of the currently authenticated user,
 * including basic profile fields and checking whether a Google account is linked.
 *
 * @param request - The incoming HTTP NextRequest.
 * @returns A JSON response with the user's details and status code 200, or a 401/404/500 error response.
 */
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
      {
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
        image: userDetails.image,
        createdAt: userDetails.createdAt,
        avatarUrl: userDetails.image,
        isGoogleLinked: hasGoogleAccount,
        hasPassword: userDetails.passwordHash !== null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

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

/**
 * DELETE /api/users/me
 *
 * Permanently deletes the account of the currently authenticated user.
 *
 * @param request - The incoming HTTP NextRequest.
 * @returns A JSON response confirming deletion and status code 200, or a 401/404/500 error response.
 */
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
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Error deleting account:", sanitizeError(error));

    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2025") {
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
