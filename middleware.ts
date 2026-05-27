import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Next.js edge middleware.
 *
 * Runs before route handlers for the paths listed in `config.matcher`.
 * API routes are excluded from the matcher -- they handle their own
 * authentication via requireAuth() / getAuthUser() in lib/middleware.ts.
 *
 * Responsibilities:
 *   - Redirect unauthenticated visitors away from protected pages.
 *   - Redirect already-authenticated visitors away from /login and /signup.
 *
 * Note: Only the NextAuth session cookie is readable in the Edge runtime.
 * Custom JWT Bearer tokens (used exclusively in API calls) are handled
 * entirely within the per-route requireAuth() helper.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let token: Awaited<ReturnType<typeof getToken>> | null = null;

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
    loginUrl.searchParams.set("callbackUrl", pathname);
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
     *   _next/static  -- compiled static assets
     *   _next/image   -- image optimisation
     *   favicon.ico   -- browser tab icon
     *   api/          -- API routes use per-handler requireAuth()
     */
    "/((?!_next/static|_next/image|favicon\.ico|api/).*)",
  ],
};
