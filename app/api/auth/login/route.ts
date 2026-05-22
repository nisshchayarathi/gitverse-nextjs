import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rateLimit";
import { checkRateLimit } from '@/utils/rateLimit';
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";

import { parseJsonBody, validateEmail, validatePassword } from "@/lib/validateAuth";
import { badRequestResponse } from "@/lib/middleware";

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return badRequestResponse(parsed.error);
    const { body } = parsed;

    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) return badRequestResponse(emailCheck.error!);

    const passwordCheck = validatePassword(body.password);
    if (!passwordCheck.valid) return badRequestResponse(passwordCheck.error!);

    const email = body.email as string;
    const password = body.password as string;
// 1. EXTRACT IP AND CHECK RATE LIMIT FIRST
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown-ip';
    
    const rateLimitResult = checkRateLimit(ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { 
          status: 429, 
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '900'
          }
        }
      );
    }

    // 2. PARSE BODY
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security: never allow password login for Google-only accounts.
    if (!user.passwordHash) {
      const hasGoogleAccount =
        (await prisma.account.count({
          where: { userId: user.id, provider: "google" },
        })) > 0;

      if (hasGoogleAccount) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Verify password
    const passwordHash = user.passwordHash || (user as any).password;
    if (!passwordHash) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);

    if (!isValidPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: (user as any).image,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
