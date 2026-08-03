/**
 * CSRF Protection Utility
 *
 * Validates Origin/Referer headers to prevent Cross-Site Request Forgery attacks.
 * Only applies to requests authenticated via session cookies (NextAuth).
 * JWT Bearer tokens and API keys are inherently CSRF-safe.
 *
 * Usage:
 *   import { validateCsrfOrigin } from "@/lib/utils/csrf";
 *   if (!validateCsrfOrigin(request)) {
 *     return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
 *   }
 */

import { NextRequest } from "next/server";

const CSRF_BYPASS_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * Get the list of allowed origins from environment variables.
 * Returns unique, non-empty origins.
 */
function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (nextauthUrl) {
    origins.add(nextauthUrl.replace(/\/+$/, ""));
  }

  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (nextPublicApiUrl && nextPublicApiUrl !== "") {
    origins.add(nextPublicApiUrl.replace(/\/+$/, ""));
  }

  // In development, allow localhost with any port
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
  }

  return Array.from(origins);
}

/**
 * Validate that an Origin or Referer header matches an allowed origin.
 *
 * @param request The incoming Next.js request
 * @returns true if the request origin is valid, false otherwise
 */
export function validateCsrfOrigin(request: NextRequest): boolean {
  // Safe methods don't need CSRF protection
  if (CSRF_BYPASS_METHODS.includes(request.method)) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // If no origins are configured, fail closed — missing security configuration
  // should never silently disable CSRF protection, even in development.
  if (allowedOrigins.length === 0) {
    console.warn(
      "[CSRF] No allowed origins configured. Rejecting request. " +
      "Set NEXTAUTH_URL or NEXT_PUBLIC_API_URL to enable CSRF validation."
    );
    return false;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Check Origin header first (most reliable)
  if (origin) {
    const normalizedOrigin = origin.replace(/\/+$/, "");
    return allowedOrigins.some(
      (allowed) => normalizedOrigin === allowed || normalizedOrigin.startsWith(allowed + "/")
    );
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`.replace(/\/+$/, "");
      return allowedOrigins.some(
        (allowed) => refererOrigin === allowed || refererOrigin.startsWith(allowed + "/")
      );
    } catch {
      // Invalid referer URL
      return false;
    }
  }

  // No Origin or Referer header — reject
  // Legitimate browser requests always include one of these for cross-origin
  return false;
}

/**
 * Check if the request is authenticated via session cookie (not JWT/API key).
 * Session cookie auth is vulnerable to CSRF; JWT/API key auth is not.
 */
export function isSessionCookieAuth(request: NextRequest): boolean {
  // If there's an Authorization header, it's not session-only auth
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return false;
  }

  // Check for NextAuth session cookie
  const sessionCookie =
    request.cookies.get("next-auth.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token");

  return !!sessionCookie;
}
