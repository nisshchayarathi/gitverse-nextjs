import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Validates that a state-changing request originates from the same site.
 *
 * Strategy: check the `Origin` header (preferred) or fall back to `Referer`.
 * Requests without either header from non-Bearer authenticated routes are rejected.
 *
 * Bearer-token requests are exempt — they cannot be triggered cross-site via
 * browser form/fetch without CORS cooperation from the server.
 */
export function validateCsrfOrigin(request: NextRequest): boolean {
  // Safe methods never mutate state — no check needed.
  if (SAFE_METHODS.has(request.method)) return true;

  // Bearer-token requests are not cookie-based — skip CSRF check.
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return true;

  const allowedOrigin =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!allowedOrigin) {
    // In development without NEXTAUTH_URL set, allow localhost origins.
    if (process.env.NODE_ENV !== "production") return true;
    console.error(
      "[CSRF] NEXTAUTH_URL is not set — cannot validate origin in production",
    );
    return false;
  }

  try {
    const expectedOrigin = new URL(allowedOrigin).origin;

    // Prefer Origin header (sent on all cross-origin and same-site requests in modern browsers).
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        return new URL(origin).origin === expectedOrigin;
      } catch {
        return false;
      }
    }

    // Fall back to Referer (older browsers, some server-side calls).
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        return new URL(referer).origin === expectedOrigin;
      } catch {
        return false;
      }
    }
  } catch (err) {
    console.error(
      "[CSRF] Error parsing allowed origin or request headers:",
      err,
    );
    return false;
  }

  // No origin information — reject in production, allow in dev.
  return process.env.NODE_ENV !== "production";
}

export function csrfError() {
  return NextResponse.json(
    { error: "CSRF validation failed: request origin not allowed" },
    { status: 403 },
  );
}
