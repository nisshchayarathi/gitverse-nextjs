jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;

    headers: Headers;

    body: unknown;

    constructor(status: number, headers?: HeadersInit, body?: unknown) {
      this.status = status;
      this.headers = new Headers(headers);
      this.body = body;
    }

    async json() {
      return this.body;
    }

    static json(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
      return new MockNextResponse(init?.status ?? 200, init?.headers, body);
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

import { createAuthFailureResponse } from "../auth-response";

describe("createAuthFailureResponse", () => {
  it("adds an expired-token bearer challenge", () => {
    const response = createAuthFailureResponse(
      "Not authenticated",
      "expired"
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="invalid_token", error_description="The access token expired"'
    );
    expect(response.body).toEqual({ error: "Not authenticated" });
  });

  it("adds a generic bearer challenge for invalid tokens", () => {
    const response = createAuthFailureResponse(
      "Not authenticated",
      "invalid"
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="invalid_token"'
    );
    expect(response.body).toEqual({ error: "Not authenticated" });
  });

  it("omits the bearer challenge when no bearer token failure is known", () => {
    const response = createAuthFailureResponse(
      "Not authenticated",
      null
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(response.body).toEqual({ error: "Not authenticated" });
  });
});