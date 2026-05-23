import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { z } from "zod";

// 1. Define a strict, reusable validation schema
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.email({ message: "Invalid email address" }).toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 2. Validate input against the Zod schema
    const validationResult = signupSchema.safeParse(body);
    
    if (!validationResult.success) {
      // Extract the first descriptive error message to return to the client
      const firstError = validationResult.error.issues[0].message;
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Stripped, safely typed data from validation
    const { email, password, name } = validationResult.data;

    // 3. Check if user already exists
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

    // 4. Hash password with secure salt rounds
    const hashedPassword = await bcrypt.hash(password, 12); // Increased to 12 rounds for better real-world security

    // 5. Database transaction creation
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
      },
    });

    // 6. Generate JWT token
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
    console.error("Signup error:", sanitizeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}