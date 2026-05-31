import { NextResponse } from "next/server";

export type BearerTokenError = "expired" | "invalid";

export function createBearerChallengeHeader(
  error: BearerTokenError
): string {
  if (error === "expired") {
    return 'Bearer error="invalid_token", error_description="The access token expired"';
  }

  return 'Bearer error="invalid_token"';
}

export function createAuthFailureResponse(
  message: string,
  bearerTokenError: BearerTokenError | null
): NextResponse {
  const headers: Record<string, string> = {};

  if (bearerTokenError) {
    headers["WWW-Authenticate"] = createBearerChallengeHeader(
      bearerTokenError
    );
  }

  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers,
    }
  );
}