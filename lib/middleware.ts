import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyTokenWithUserValidation } from "./auth";
import { verifyToken } from "./auth";
import { getNextAuthSecret } from "./config/env";
import type { JWTPayload } from "./auth";
import prisma from "@/lib/prisma";
import { getToken } from "next-auth/jwt";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

/**
 * Resolves the authenticated user from either a JWT bearer token
 * or a NextAuth session cookie.
 * Rejects tokens issued before the user's latest password change.
 * Uses secure token validation with tokenVersion verification.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get("authorization");
  let userPayload: JWTPayload | null = null;

  // 1) Secure JWT auth (Authorization: Bearer ...)
  // Uses verifyTokenWithUserValidation for proper tokenVersion checking
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    try {
      const payload = await verifyTokenWithUserValidation(token);
      
      if (payload) {
        // Additional security check: verify user still exists
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            tokenVersion: true,
            lockedUntil: true,
          },
        });

        if (!dbUser) {
          return null;
        }

        if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
          return null;
        }

        // Double-check tokenVersion matches (extra security)
        if (payload.tokenVersion !== dbUser.tokenVersion) {
          return null;
        }

        userPayload = payload;
      }
    } catch (error) {
      console.warn("[Auth] JWT validation error:", error);
      return null;
    }
  }

  // 2) NextAuth session cookie (Google OAuth)
  if (!userPayload) {
    try {
      const token = await getToken({
        req: request,
        secret: getNextAuthSecret(),
      });

      if (token?.sub && token.email) {
        const userId = Number(token.sub);

        if (!Number.isFinite(userId)) {
          return null;
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            passwordChangedAt: true,
            tokenVersion: true,
            lockedUntil: true,
          },
        });

        if (!dbUser) {
          return null;
        }

        if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
          return null;
        }

        const issuedAt =
          typeof token.iat === "number"
            ? token.iat
            : null;

        if (
          dbUser.passwordChangedAt &&
          (issuedAt === null ||
            issuedAt * 1000 <=
              dbUser.passwordChangedAt.getTime())
        ) {
          return null;
        }

        // Validate tokenVersion for NextAuth session cookies.
        // The JWT callback attaches tokenVersion at sign-in; if it no longer
        // matches the DB value (after password change or logout), reject.
        const jwtTokenVersion = (token as any).tokenVersion as number | undefined;
        if (
          jwtTokenVersion != null &&
          jwtTokenVersion !== dbUser.tokenVersion
        ) {
          return null;
        }

        userPayload = {
          userId,
          email: token.email,
        };
      }
    } catch {
      // Ignore token retrieval errors
    }
  }

  if (!userPayload) return null;

  // Final verification: ensure user still exists
  try {
    const finalUser = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      select: {
        id: true,
        tokenVersion: true,
        lockedUntil: true,
      },
    });

    if (!finalUser) {
      return null;
    }

    if (finalUser.lockedUntil && finalUser.lockedUntil > new Date()) {
      return null;
    }
  } catch (error) {
    console.error(
      "Database check failed in auth middleware:",
      error
    );
    return null;
  }

  return userPayload;
}

/**
 * Ensures the incoming request is authenticated.
 * Throws an HttpError if authentication fails.
 */
export async function requireAuth(
  request: NextRequest
): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

/**
 * Ensures the authenticated user owns the requested resource.
 */
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

export function isHttpError(
  error: unknown
): error is HttpError {
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

    return str.length > 200
      ? str.substring(0, 200) + "..."
      : str;
  } catch {
    return "Unknown error";
  }
}

export function badRequestResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function getPrismaErrorResponse(error: any): NextResponse | null {
  const isColdStartError =
    error?.code === 'P1001' ||
    error?.code === 'P2024' ||
    error?.message?.toLowerCase().includes('timeout') ||
    error?.message?.toLowerCase().includes('connection pool') ||
    error?.message?.toLowerCase().includes('connect') ||
    error?.message?.toLowerCase().includes('fetch failed');

  if (isColdStartError) {
    return NextResponse.json(
      { error: "DATABASE_COLD_START", message: "Waking up database..." },
      { status: 503 }
    );
  }

  return null;
}
