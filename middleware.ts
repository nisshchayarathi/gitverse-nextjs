/**
 * Next.js Edge Middleware
 *
 * Responsibilities (in order):
 *  1. Apply baseline security headers to every response.
 *  2. Protect authenticated page routes — redirect unauthenticated visitors
 *     to /login.
 *
 * Security headers applied
 * ────────────────────────
 *  X-Content-Type-Options      nosniff
 *    Prevents browsers from MIME-sniffing a response away from the declared
 *    content-type, blocking drive-by-download attacks.
 *
 *  Referrer-Policy             strict-origin-when-cross-origin
 *    Sends the full URL as referrer for same-origin requests; only the origin
 *    for cross-origin HTTPS→HTTPS; nothing for HTTPS→HTTP downgrades.
 *
 *  Permissions-Policy          camera=(), microphone=(), geolocation=()
 *    Disables browser features this app does not use, reducing the attack
 *    surface if a dependency is ever compromised.
 *
 *  X-Frame-Options             SAMEORIGIN
 *    Prevents the app from being embedded in an iframe on a foreign origin,
 *    mitigating clickjacking. (Redundant once a frame-ancestors CSP directive
 *    is added, but kept for older browser compatibility.)
 *
 *  Strict-Transport-Security   max-age=63072000; includeSubDomains; preload
 *    Tells browsers to only contact this origin over HTTPS for the next 2 years.
 *    Only sent over HTTPS to avoid breaking local HTTP development.
 *
 * Auth-redirect rules
 * ───────────────────
 *  Protected page routes (/dashboard/*, /profile/*, /settings/*) require a
 *  valid NextAuth session. Unauthenticated requests are redirected to /login
 *  with a `from` query param so the user lands back after sign-in.
 *
 *  The following are always allowed through without an auth check:
 *    • /api/auth/*  — NextAuth internals (OAuth callbacks, CSRF, session)
 *    • All other /api/* routes — each route handler does its own auth check
 *    • Public pages (/login, /signup, /forgot-password, /reset-password, /)
 *    • Static assets (/_next/*, /favicon.ico, /robots.txt, /sitemap.xml)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Mutates `response` by setting the baseline security headers.
 * Called on every matched request, regardless of auth outcome.
 */
function applySecurityHeaders(response: NextResponse): void {
  const h = response.headers;

  // Prevent MIME-type sniffing.
  h.set("X-Content-Type-Options", "nosniff");

  // Control referrer information sent with requests.
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable browser features this app does not use.
  h.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );

  // Clickjacking protection (belt-and-suspenders alongside a future CSP).
  h.set("X-Frame-Options", "SAMEORIGIN");

  // HSTS — only set over HTTPS to avoid breaking local HTTP dev.
  // The `x-forwarded-proto` header is set by Vercel/proxies in production.
  const proto = response.headers.get("x-forwarded-proto");
  const isHttps =
    proto === "https" ||
    process.env.NODE_ENV === "production";

  if (isHttps) {
    h.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
}

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

/** Routes that require an authenticated session. */
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/repo",
  "/analysis",
  "/search",
];

/**
 * Returns true for paths that must never be blocked by auth middleware:
 *  - NextAuth internals (/api/auth/*)
 *  - Public auth pages
 *  - Static / Next.js internal assets
 */
function isPublicPath(pathname: string): boolean {
  return (
    // NextAuth OAuth callbacks, CSRF endpoint, session endpoint, etc.
    pathname.startsWith("/api/auth/") ||
    // Public pages
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/contribute") ||
    // Next.js internals and static files
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

/** Returns true if the path requires an authenticated session. */
function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Always let public paths through — but still attach security headers.
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  }

  // 2. For protected page routes, verify the session.
  if (isProtectedPage(pathname)) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        // Redirect to login, preserving the intended destination.
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("from", pathname);
        const redirectResponse = NextResponse.redirect(loginUrl);
        applySecurityHeaders(redirectResponse);
        return redirectResponse;
      }
    } catch (err) {
      // If token verification fails unexpectedly, fail open for page routes
      // (redirect to login) rather than returning a 500 that breaks the UX.
      console.error("[middleware] getToken error:", err);
      const loginUrl = new URL("/login", request.url);
      const redirectResponse = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirectResponse);
      return redirectResponse;
    }
  }

  // 3. All other routes (API routes, unmatched paths) — pass through with headers.
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

// ---------------------------------------------------------------------------
// Matcher — which paths this middleware runs on
// ---------------------------------------------------------------------------
// Excludes static file extensions and Next.js internals that never need
// security headers or auth checks (images, fonts, etc.).
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - Files with an extension (e.g. .png, .ico, .svg, .woff2)
     */
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|otf|eot|css|js\\.map)$).*)",
  ],
};
