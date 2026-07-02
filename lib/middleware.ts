import { NextRequest, NextResponse } from "next/server";
import { verifyTokenWithUserValidation } from "./auth";
import { getNextAuthSecret } from "./config/env";
import type { JWTPayload } from "./auth";
import prisma from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import { hashApiKey } from "@/lib/utils/api-key";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

/**
 * Resolves the authenticated user from either a JWT bearer token,
 * an API key, or a NextAuth session cookie.
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
    
    // Try API key lookup first (fast, no crypto overhead)
    if (token.startsWith("gv_")) {
      const hashed = hashApiKey(token);
      try {
        const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
        if (apiKey && apiKey.expiresAt > new Date()) {
          const dbUser = await prisma.user.findUnique({
            where: { id: apiKey.userId },
            select: { id: true, email: true, name: true, tokenVersion: true, lockedUntil: true },
          });
          if (dbUser && (!dbUser.lockedUntil || dbUser.lockedUntil <= new Date())) {
            await prisma.apiKey.update({
              where: { id: apiKey.id },
              data: { lastUsedAt: new Date() },
            });
            userPayload = { userId: dbUser.id, email: dbUser.email, tokenVersion: dbUser.tokenVersion };
          }
        }
      } catch {
        // DB error — fall through to other auth methods
      }
    }

    // Try JWT token (existing behavior)
    if (!userPayload) {
      try {
        const payload = await verifyTokenWithUserValidation(token);
        
        if (payload) {
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
          try {
            request.cookies.delete("next-auth.session-token");
            request.cookies.delete("next-auth.csrf-token");
            request.cookies.delete("next-auth.callback-url");
          } catch {
            // Best-effort cookie clearing
          }
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

const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()) : [];

/**
 * Checks if the given user is an administrator.
 */
export function isAdmin(user: JWTPayload): boolean {
  return ADMIN_EMAILS.includes(user.email);
}

/**
 * Ensures the incoming request is authenticated AND the user is an admin.
 * Throws an HttpError if authentication or authorization fails.
 */
export async function requireAdmin(request: NextRequest): Promise<JWTPayload> {
  const user = await requireAuth(request);

  if (!isAdmin(user)) {
    throw new HttpError(403, "Forbidden: Admin access required");
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
    typeof (error as any).status === "number" &&
    "message" in error &&
    typeof (error as any).message === "string"
  );
}

/**
 * Sanitizes error objects for safe logging.
 * Extracts message, code, and other safe properties while filtering sensitive data.
 */
export function sanitizeError(error: unknown): Record<string, any> {
  if (!error) {
    return { message: "Unknown error" };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error instanceof Error) {
    const sanitized: Record<string, any> = {
      message: error.message,
      name: error.name,
    };

    // Include safe error properties if they exist
    if ("code" in error) {
      sanitized.code = (error as any).code;
    }
    if ("status" in error) {
      sanitized.status = (error as any).status;
    }
    if ("statusCode" in error) {
      sanitized.statusCode = (error as any).statusCode;
    }

    return sanitized;
  }

  if (typeof error === "object") {
    const obj = error as Record<string, any>;
    return {
      message: obj.message || JSON.stringify(obj),
      code: obj.code,
      status: obj.status,
      statusCode: obj.statusCode,
    };
  }

  return { message: String(error) };
}

export function getPrismaErrorResponse(error: unknown): NextResponse | null {
  if (!error || typeof error !== "object") return null;

  const err = error as any;
  const message = err?.message;
  const code = err?.code;

  if (code === "P1011" || (typeof message === "string" && message.toLowerCase().includes("cold start"))) {
    return NextResponse.json(
      { error: "Database is starting up. Please try again in a moment." },
      { status: 503 },
    );
  }

  return null;
}

// This tells Next.js WHICH pages/routes to protect
export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/profile/:path*"],
};
