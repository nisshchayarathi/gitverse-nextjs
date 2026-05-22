import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "./auth";
import { getToken } from "next-auth/jwt";

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

  // 1) Existing JWT auth (Authorization: Bearer ...)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  // 2) NextAuth session cookie (Google OAuth)
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.sub || !token.email) return null;

    const userId = Number(token.sub);
    if (!Number.isFinite(userId)) return null;

    return { userId, email: token.email };
  } catch {
    return null;
  }
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