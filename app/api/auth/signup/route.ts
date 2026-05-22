import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rateLimit";
import { checkRateLimit } from '@/utils/rateLimit';
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";

import { parseJsonBody, validateEmail, validatePassword, validateRequiredString } from "@/lib/validateAuth";
import { badRequestResponse } from "@/lib/middleware";

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return badRequestResponse(parsed.error);
    const { body } = parsed;
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
    
    //2. PARSE BODY
    const body = await request.json();
    const { email, password, name } = body;

    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) return badRequestResponse(emailCheck.error!);

    const passwordCheck = validatePassword(body.password);
    if (!passwordCheck.valid) return badRequestResponse(passwordCheck.error!);

    const nameCheck = validateRequiredString(body.name, "Name");
    if (!nameCheck.valid) return badRequestResponse(nameCheck.error!);

    const email = body.email as string;
    const password = body.password as string;
    const name = body.name as string;
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const isGoogleOnly =
        !existingUser.passwordHash &&
        (await prisma.account.count({
          where: { userId: existingUser.id, provider: "google" },
        })) > 0;

      if (isGoogleOnly) {
        return NextResponse.json(
          { error: "Email already exists. Please sign in with Google." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
      },
    });

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: (user as any).image,
        },
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
