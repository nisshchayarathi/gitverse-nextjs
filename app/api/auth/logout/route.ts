import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import { getNextAuthSecret } from "@/lib/config/env";
import { appendClearCookieHeaders } from "@/lib/utils/authCookie";

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
      data: {
        tokenVersion: { increment: 1 },
        passwordChangedAt: new Date(),
      },
    });

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const nextAuthToken = await getToken({
        req: request,
        secret: getNextAuthSecret(),
      });

      if (nextAuthToken) {
        await prisma.session.deleteMany({
          where: { userId: user.userId },
        });

        const response = NextResponse.json({
          message: "Logged out successfully",
        });
        appendClearCookieHeaders(response);
        return response;
      }
    }

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
