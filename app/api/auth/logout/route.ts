import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
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