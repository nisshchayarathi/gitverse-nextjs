import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";

/**
 * Next.js edge middleware.
 *
 * Runs before route handlers for the paths listed in `config.matcher`.
 * API routes are excluded from the matcher -- they handle their own
 * authentication via requireAuth() / getAuthUser() in lib/middleware.ts.
 *
 * Responsibilities:
 * - Redirect unauthenticated visitors away from protected pages.
 * - Redirect already-authenticated visitors away from /login and /signup.
 *
 * Note: Only the NextAuth session cookie is readable in the Edge runtime.
 * Custom JWT Bearer tokens (used exclusively in API calls) are handled
 * entirely within the per-route requireAuth() helper.
 */

/**
 * Verifies the mock-session cookie using HMAC-SHA256.
 * The cookie value format is: `<value>.<hex-signature>`
 * The signature is HMAC of the value using MOCK_SESSION_HMAC_KEY.
 *
 * Returns true only if:
 * - The HMAC key is configured
 * - The signature is valid
 * - The timestamp embedded in the value is less than 24 hours old
 */
function verifyMockSessionCookie(cookieValue: string): boolean {
  const hmacKey = process.env.MOCK_SESSION_HMAC_KEY;
  if (!hmacKey) return false;

  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return false;

  const value = cookieValue.substring(0, lastDot);
  const providedSig = cookieValue.substring(lastDot + 1);

  const expectedSig = crypto
    .createHmac("sha256", hmacKey)
    .update(value)
    .digest("hex");

  if (providedSig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))) {
    return false;
  }

  // value format: "<mock-value>|<timestamp>"
  const pipeIndex = value.lastIndexOf("|");
  if (pipeIndex === -1) return false;

  const timestamp = parseInt(value.substring(pipeIndex + 1), 10);
  if (isNaN(timestamp)) return false;

  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  return Date.now() - timestamp < MAX_AGE_MS;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔥 FIX: Explicitly bypass middleware for all webhook routes.
  // Webhooks use independent HMAC signature validation (not session auth).
  // This prevents accidental 401s if a webhook path overlaps with a protected route regex.
  if (pathname.includes("/webhook")) {
    return NextResponse.next();
  }

  let token: Awaited<ReturnType<typeof getToken>> | null = null;

  const mockSessionCookie = request.cookies?.get?.("mock-session")?.value;
  const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === "true";
  const isProduction = process.env.NODE_ENV === "production";
  // Require MOCK_SESSION_HMAC_KEY to be explicitly set — prevents accidental activation
  // if PLAYWRIGHT_TEST leaks into a staging/production environment (issue #2648).
  const mockHmacKeyConfigured = !!process.env.MOCK_SESSION_HMAC_KEY;

  if (isPlaywrightTest && !isProduction && mockHmacKeyConfigured && mockSessionCookie) {
    if (verifyMockSessionCookie(mockSessionCookie)) {
      console.warn(
        "[Auth] MOCK SESSION ACTIVE — this must NEVER appear in production. " +
        "Request: " + pathname
      );
      token = { name: "Test User", email: "test@test.com", sub: "1" } as any;
    }
    // Invalid/missing HMAC signature — fall through to real auth
  }

  if (!token) {
    try {
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
    } catch {
      // If getToken fails (misconfigured secret, network issue, etc.) treat the
      // user as unauthenticated rather than crashing the middleware.
      token = null;
    }
  }

  const isAuthenticated = !!token;

  // Pages that require a valid session.
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/repositories") ||
    pathname.startsWith("/analysis") ||
    pathname.startsWith("/analyze") ||
    pathname.startsWith("/repo") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/contribute");

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);

    // 🔥 FIX: Include query parameters so deep links aren't destroyed on redirect
    const callbackPath = request.nextUrl.search
      ? `${pathname}${request.nextUrl.search}`
      : pathname;

    loginUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages -- avoid showing login/signup to already-authenticated users.
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run middleware on every path except:
     * _next/static  -- compiled static assets
     * _next/image   -- image optimisation
     * favicon.ico   -- browser tab icon
     * api/          -- API routes use per-handler requireAuth()
     * webhook       -- webhook paths bypass session auth entirely
     * public files  -- explicitly ignore common static asset extensions to save Edge compute
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:[Ss][Vv][Gg]|[Pp][Nn][Gg]|[Jj][Pp][Ee]?[Gg]|[Gg][Ii][Ff]|[Ww][Ee][Bb][Pp]|[Tt][Xx][Tt]|[Xx][Mm][Ll])$|api/|.*webhook.*).*)",
  ],
};