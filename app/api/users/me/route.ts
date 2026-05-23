import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isHttpError, sanitizeError } from "@/lib/middleware";

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
      },
    });

    const hasGoogleAccount =
      (await prisma.account.count({
        where: { userId: user.userId, provider: "google" },
      })) > 0;

    if (!userDetails) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: userDetails.id,
      name: userDetails.name,
      email: userDetails.email,
      image: userDetails.image,
      createdAt: userDetails.createdAt,
      avatarUrl: userDetails.image,
      isGoogleLinked: hasGoogleAccount,
    });
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    console.error("Error fetching user:", sanitizeError(error));
    return NextResponse.json(
      { message: "Failed to fetch user" },
      { status: 500 },
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

    await prisma.user.delete({
      where: { id: user.userId },
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2025") {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    console.error("Error deleting account:", sanitizeError(error));
    return NextResponse.json(
      { message: "Failed to delete account" },
      { status: 500 },
    );
  }
}
