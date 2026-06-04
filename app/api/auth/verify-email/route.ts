import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

/**
 * Verifies a user's email address using a one-time token sent via email.
 * Redirects to /login?verified=1 on success, or /login?error=... on failure.
 * @param request - The incoming Next.js request containing the token query param
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", request.url));
  }

  // Hash the token to match what was stored
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record || record.expires < new Date()) {
    return NextResponse.redirect(new URL("/login?error=TokenExpired", request.url));
  }

  // Mark user as verified
  try {
    // Mark user as verified
    await prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    });
    // Consume the one-time token
    await prisma.verificationToken.delete({
      where: { token: tokenHash },
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=VerificationFailed", request.url));
  }

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}