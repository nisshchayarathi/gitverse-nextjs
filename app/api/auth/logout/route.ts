import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sanitizeError } from "@/lib/middleware";
import { blacklistToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { getToken } from "next-auth/jwt";
import { getNextAuthSecret } from "@/lib/config/env";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }

    let logoutAllDevices = false;
    try {
      const body = await request.json();
      logoutAllDevices = body?.logoutAllDevices === true;
    } catch {}

    if (logoutAllDevices) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.userId },
          data: { tokenVersion: { increment: 1 } },
        }),
        prisma.session.deleteMany({ where: { userId: user.userId } }),
        prisma.blacklistedToken.deleteMany({ where: { userId: user.userId } }),
      ]);
    } else {
      const jti = await extractJti(request, user);
      if (jti) {
        const expiresAt = await getTokenExpiry(request) ??
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await blacklistToken(jti, user.userId, expiresAt);
      } else {
        console.warn(`[Logout] Single-device logout skipped: missing jti for user ${user.userId}. Token may be legacy or malformed.`);
      }
    }

    const response = NextResponse.json({
      message: logoutAllDevices
        ? "Logged out from all devices successfully"
        : "Logged out successfully",
    });

    for (const name of [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.callback-url",
      "next-auth.csrf-token",
    ]) {
      response.cookies.set(name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error("Logout error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to process logout request" },
      { status: 500 }
    );
  }
}

async function extractJti(
  request: NextRequest,
  user: { userId: number; jti?: string }
): Promise<string | null> {
  if (user.jti) return user.jti;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.decode(authHeader.substring(7)) as { jti?: string } | null;
      if (decoded?.jti) return decoded.jti;
    } catch {}
  }

  try {
    const token = await getToken({ req: request, secret: getNextAuthSecret() });
    if ((token as any)?.jti) return (token as any).jti as string;
  } catch {}

  return null;
}

async function getTokenExpiry(request: NextRequest): Promise<Date | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.decode(authHeader.substring(7)) as { exp?: number } | null;
      if (decoded?.exp) return new Date(decoded.exp * 1000);
    } catch {}
  }

  try {
    const token = await getToken({ req: request, secret: getNextAuthSecret() });
    if (token?.exp) return new Date((token.exp as number) * 1000);
  } catch {}

  return null;
}