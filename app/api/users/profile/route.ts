import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";
import bcrypt from "bcryptjs";

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, email, avatar, newPassword } = body;

    if (!name || !email) {
      return NextResponse.json(
        { message: "Name and email are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.userId },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email is already in use" },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        email: true,
        accounts: { select: { provider: true }, where: { provider: "google" } },
      },
    });

    const isEmailChanging =
      !!current?.email &&
      typeof email === "string" &&
      email.toLowerCase() !== current.email.toLowerCase();

    const hasLinkedGoogle = (current?.accounts?.length ?? 0) > 0;

    if (isEmailChanging && hasLinkedGoogle) {
      if (!newPassword || typeof newPassword !== "string") {
        return NextResponse.json(
          {
            message:
              "Changing email will unlink your Google account. Please provide newPassword to set a new password.",
          },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { message: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      // Unlink Google account (prevents Google sign-in for this user unless re-linked).
      await prisma.account.deleteMany({
        where: { userId: user.userId, provider: "google" },
      });
    }

    const updateData: any = { name, email };

    if (isEmailChanging && hasLinkedGoogle) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (avatar && (avatar.startsWith("data:") || avatar.startsWith("http"))) {
      updateData.image = avatar;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...updatedUser,
      avatarUrl: (updatedUser as any).image,
    });
  } catch (error: any) {
    console.error("Error updating profile:", sanitizeErrorMessage(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
