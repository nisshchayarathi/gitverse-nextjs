import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth, isHttpError } from "@/lib/middleware";

/**
 * POST /api/users/change-password
 *
 * Securely modifies the password of the currently authenticated user.
 * Validates the current password if one is already set on the account,
 * enforces a minimum password length of 8 characters, and securely hashes the new password before storage.
 *
 * @param request - The incoming HTTP NextRequest containing currentPassword and newPassword fields.
 * @returns A JSON response with status code 200 on success, or a 400/401/404/500 error response.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { message: "New password is required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!userDetails) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const passwordHash = userDetails.passwordHash;
    if (passwordHash) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          { message: "Current password is required" },
          { status: 400 },
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        passwordHash,
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { message: "Current password is incorrect" },
          { status: 401 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.userId },
      data: { passwordHash: hashedPassword },
    });

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    console.error("Error changing password:", error);
    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 },
    );
  }
}
