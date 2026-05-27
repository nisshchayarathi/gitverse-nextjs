import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "./auth";
import { getToken } from "next-auth/jwt";
import prisma from "./prisma";

/**
 * Representation of an authenticated request carrying a verified user payload.
 */
export interface AuthenticatedRequest {
  /** The verified JWT payload associated with the authenticated user session. */
  user: JWTPayload;
}

/**
 * Retrieves and validates the user credentials from the request headers or session cookies.
 * It checks for a traditional JWT token in the Authorization header first,
 * and falls back to a NextAuth session token (for Google OAuth sessions).
 *
 * @param request - The incoming Next.js HTTP request context.
 * @returns The decoded JWTPayload if valid; otherwise, null.
 */
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

  // 3) Verify user existence and token version to block deleted/revoked users
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      select: { id: true, tokenVersion: true },
    });
    if (!dbUser) return null;
    // If token carries a tokenVersion, reject if the user's version has been
    // incremented (e.g. after logout or password change). Tokens issued before
    // this field was added carry no tokenVersion and are accepted for backward
    // compatibility — they will naturally expire within 7 days.
    if (
      userPayload.tokenVersion != null &&
      userPayload.tokenVersion < dbUser.tokenVersion
    ) {
      return null;
    }
  } catch (error) {
    console.error("Database check failed in auth middleware:", error);
    return null;
  }

  return userPayload;
}

/**
 * Route guard that strictly requires a user to be authenticated.
 * If authentication succeeds, it returns the verified user context;
 * otherwise, it throws a 401 HttpError.
 *
 * @param request - The incoming Next.js HTTP request context.
 * @throws {HttpError} If no valid user session is detected (401 Unauthorized).
 * @returns The active user payload.
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

/**
 * Route guard that strictly requires the authenticated user to be the owner of the resource.
 * If authentication and ownership succeed, it returns the verified user context;
 * otherwise, it throws a 403 HttpError.
 *
 * @param request - The incoming Next.js HTTP request context.
 * @param resourceUserId - The user ID of the resource owner.
 * @throws {HttpError} If no valid user session is detected (401) or if the user is not the owner (403).
 * @returns The active user payload.
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

/**
 * Standard HTTP Error container that carries a status code and detailed error message.
 * Used internally to control status codes thrown during route processing and middleware guards.
 */
export class HttpError extends Error {
  /** The specific HTTP status code for this error (e.g. 400, 401, 403, 404). */
  status: number;

  /**
   * Constructs a new HttpError.
   *
   * @param status - The HTTP status code.
   * @param message - The human-readable error description.
   */
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Strict runtime type guard to check if an unknown error object is an instance of HttpError.
 *
 * @param error - The caught unknown error context.
 * @returns True if the error is a validated HttpError instance; otherwise, false.
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as any).status === "number"
  );
}

/**
 * Sanitizes unknown error objects into safe, human-readable strings.
 *
 * @param error - The caught unknown error context.
 * @returns A clean string representing the error message.
 */
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

/**
 * Standard JSON error response builder.
 *
 * @param message - The error message.
 * @param status - The HTTP status code (defaults to 400).
 * @returns A Next.js NextResponse containing the error.
 */
export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard Next.js edge middleware routing logic that intercepts matching dashboard/profile/API paths.
 * Validates active session state and prevents users from accessing cross-user resources.
 *
 * @param request - The incoming request path and context.
 * @returns NextResponse to continue or redirect.
 */
export async function middleware(request: NextRequest) {
  try {
    // Step 1: Get the logged-in user's session token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Step 2: If no token, user is not logged in → redirect to login
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const userId = token.sub; // This is the logged-in user's ID

    // Step 3: Get the resource owner ID from the request headers (if provided)
    const resourceOwnerId = request.headers.get("x-resource-owner-id");

    // Step 4: If a resource owner is specified, check it matches the logged-in user
    if (resourceOwnerId && resourceOwnerId !== userId) {
      // Someone is trying to access another user's data → block them!
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this resource." },
        { status: 403 }
      );
    }

    // Step 5: Everything checks out → allow the request to continue
    return NextResponse.next();

  } catch (error) {
    // Step 6: Something went wrong on the server → return 500 error
    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Middleware matcher configuration parameters specifying which path hierarchies are guarded.
 */
export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/profile/:path*"],
};
