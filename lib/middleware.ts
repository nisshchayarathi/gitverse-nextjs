import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";
import type { JWTPayload } from "./auth";
import { type BearerTokenError } from "./auth-response";
import prisma from "@/lib/prisma";
import { getToken } from "next-auth/jwt";

export interface AuthenticatedRequest {
  user: JWTPayload;
}

export interface AuthResolution {
  user: JWTPayload | null;
  bearerTokenError: BearerTokenError | null;
}

/**
 * Resolves the authenticated user from either a JWT bearer token
 * or a NextAuth session cookie.
 * Rejects tokens issued before the user's latest password change.
 */
export async function getAuthUserDetails(
  request: NextRequest
): Promise<AuthResolution> {
  const authHeader = request.headers.get("authorization");
  let userPayload: JWTPayload | null = null;
  let bearerTokenError: BearerTokenError | null = null;
  let dbUser:
    | {
        id: number;
        passwordChangedAt: Date | null;
        tokenVersion: number | null;
        lockedUntil: Date | null;
      }
    | null = null;

  // 1) Existing JWT auth (Authorization: Bearer ...)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if ("payload" in payload) {
      dbUser = await prisma.user.findUnique({
        where: { id: payload.payload.userId },
        select: {
          id: true,
          passwordChangedAt: true,
          tokenVersion: true,
          lockedUntil: true,
        },
      });

      if (!dbUser) {
        return { user: null, bearerTokenError: null };
      }

      const issuedAt =
        typeof (payload.payload as any).iat === "number"
          ? (payload.payload as any).iat
          : null;

      if (
        dbUser.passwordChangedAt &&
        (issuedAt === null ||
          issuedAt * 1000 <=
            dbUser.passwordChangedAt.getTime())
      ) {
        return { user: null, bearerTokenError: null };
      }

      userPayload = payload.payload;
    } else {
      return { user: null, bearerTokenError: payload.error };
    }
  }

  // 2) NextAuth session cookie (Google OAuth)
  if (!userPayload) {
    let token;
    try {
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
    } catch {
      // Ignore token retrieval errors
    }

    if (token?.sub && token.email) {
      const userId = Number(token.sub);

      if (!Number.isFinite(userId)) {
        return { user: null, bearerTokenError };
      }

      dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordChangedAt: true,
          tokenVersion: true,
          lockedUntil: true,
        },
      });

      if (!dbUser) {
        return { user: null, bearerTokenError };
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
        return { user: null, bearerTokenError };
      }

      // Validate tokenVersion for NextAuth session cookies.
      // The JWT callback attaches tokenVersion at sign-in; if it no longer
      // matches the DB value (after password change or logout), reject.
      const jwtTokenVersion = (token as any).tokenVersion as number | undefined;
      if (
        jwtTokenVersion != null &&
        jwtTokenVersion !== dbUser.tokenVersion
      ) {
        return { user: null, bearerTokenError };
      }

      userPayload = {
        userId,
        email: token.email,
      };
    }
  }

  if (!userPayload) {
    return { user: null, bearerTokenError };
  }

  if (!dbUser) {
    return { user: null, bearerTokenError };
  }

  if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
    return { user: null, bearerTokenError };
  }

  const isJwtAuth = !!(
    authHeader &&
    authHeader.startsWith("Bearer ")
  );

  // JWT access tokens require tokenVersion so logout/password-change can
  // revoke them immediately. Legacy NextAuth session cookies may not carry
  // tokenVersion, so we only enforce the match when it is present to preserve
  // backward compatibility.
  if (isJwtAuth) {
    // Reject legacy JWTs without tokenVersion
    if (userPayload.tokenVersion == null) {
      return { user: null, bearerTokenError: null };
    }

    // Require exact token version match
    if (
      userPayload.tokenVersion !==
      dbUser.tokenVersion
    ) {
      return { user: null, bearerTokenError: null };
    }
  }

  return { user: userPayload, bearerTokenError: null };
}

export async function getAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  const result = await getAuthUserDetails(request);

  return result.user;
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
