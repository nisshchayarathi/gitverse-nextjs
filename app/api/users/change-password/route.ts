import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, sanitizeError, isHttpError } from "@/lib/middleware";
import { logAuditEvent } from "@/lib/auditLogger";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
} from "@/lib/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const ip = getClientIp(request);

    const rlResult = await checkRateLimit({
      endpoint: "users:change-password",
      userId: user.userId,
      ip,
      tier: "free",
    });

    if (!rlResult.allowed) {
      return rateLimitResponse(rlResult);
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required and must be a string" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userDetails) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const passwordHash = userDetails.passwordHash;

    if (!passwordHash) {
      return NextResponse.json(
        {
          error:
            "This account uses OAuth. Password management is handled by your OAuth provider.",
        },
        { status: 400 }
      );
    }

    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.userId },
        data: {
          passwordHash: hashedPassword,
          passwordChangedAt: new Date(
            Math.floor(Date.now() / 1000) * 1000
          ),
          tokenVersion: {
            increment: 1,
          },
        },
      }),
      prisma.session.deleteMany({
        where: {
          userId: user.userId,
        },
      }),
    ]);

    await logAuditEvent({
      userId: user.userId,
      action: "PASSWORD_CHANGED",
      resource: "User",
      details: { ip },
      ipAddress: ip,
    });

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    console.error(
      "Error changing password:",
      sanitizeError(error)
    );

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
