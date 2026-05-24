import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "./auth";
import { getToken } from "next-auth/jwt";
import prisma from "./prisma";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get("authorization");
  let userPayload: JWTPayload | null = null;

  // 1) Existing JWT auth (Authorization: Bearer ...)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      userPayload = payload;
    }
  }

  // 2) NextAuth session cookie (Google OAuth)
  if (!userPayload) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token?.sub && token.email) {
        const userId = Number(token.sub);
        if (Number.isFinite(userId)) {
          userPayload = { userId, email: token.email };
        }
      }
    } catch {
      // Ignore token retrieval errors
    }
  }

  if (!userPayload) return null;

  // 3) Verify user existence in database to block deleted users with active JWTs
  try {
    const userExists = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      select: { id: true },
    });
    if (!userExists) return null;
  } catch (error) {
    console.error("Database check failed in auth middleware:", error);
    return null;
  }

  return userPayload;
}


export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

export async function requireOwnership(
  request: NextRequest,
  resourceUserId: number
): Promise<JWTPayload> {
  const user = await requireAuth(request);
  if (user.userId !== resourceUserId) {
    throw new HttpError(403, "Forbidden");
  }
  return user;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as any).status === "number"
  );
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    const str = String(error);
    return str.length > 200 ? str.substring(0, 200) + "..." : str;
  } catch {
    return "Unknown error";
  }
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
