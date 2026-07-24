import { NextRequest } from "next/server";

/**
 * Builds the list of allowed origins from environment variables.
 * Returns an empty array if neither NEXTAUTH_URL nor NEXT_PUBLIC_API_URL is set.
 */
export function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    try {
      const parsed = new URL(nextAuthUrl);
      origins.push(parsed.origin);
    } catch {
      // Invalid URL — skip
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      origins.push(parsed.origin);
    } catch {
      // Invalid URL — skip
    }
  }

  return [...new Set(origins)];
}

/**
 * Validates the Origin header of an incoming request against allowed origins.
 *
 * - If no Origin header is present, the request is allowed (same-origin or non-browser client).
 * - If the Origin header is present, it must match one of the allowed origins.
 * - If no allowed origins are configured, all cross-origin requests are **blocked** (fail-closed).
 */
export function validateCsrfOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  // No Origin header — same-origin request or non-browser client (e.g. curl, server-to-server).
  // These are safe to allow.
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Fail-closed: if no origins are configured, block all cross-origin requests.
  if (allowedOrigins.length === 0) {
    console.error(
      "[CSRF] No allowed origins configured — blocking cross-origin request from: " + origin
    );
    return false;
  }

  return allowedOrigins.includes(origin);
}
