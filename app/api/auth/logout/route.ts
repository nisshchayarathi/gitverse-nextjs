import { NextRequest, NextResponse } from "next/server";
import { createAuthFailureResponse } from "@/lib/auth-response";
import {
  getAuthUserDetails,
  sanitizeError,
} from "@/lib/middleware";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { user, bearerTokenError } = await getAuthUserDetails(request);

    if (!user) {
      return createAuthFailureResponse(
        "Invalid or expired authentication token",
        bearerTokenError
      );
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    return NextResponse.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", sanitizeError(error));

    return NextResponse.json(
      { error: "Failed to process logout request" },
      { status: 500 }
    );
  }
}