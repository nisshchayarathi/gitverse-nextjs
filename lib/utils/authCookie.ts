import { NextResponse } from "next/server";

const COOKIE_NAMES = ["next-auth.session-token", "next-auth.csrf-token", "next-auth.callback-url"];

const COOKIE_OPTIONS = "Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax";

export function getClearCookieHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of COOKIE_NAMES) {
    headers["Set-Cookie"] = headers["Set-Cookie"]
      ? `${headers["Set-Cookie"]}, ${name}=; ${COOKIE_OPTIONS}`
      : `${name}=; ${COOKIE_OPTIONS}`;
  }
  return headers;
}

export function appendClearCookieHeaders(response: NextResponse): void {
  for (const name of COOKIE_NAMES) {
    response.headers.append("Set-Cookie", `${name}=; ${COOKIE_OPTIONS}`);
  }
}
