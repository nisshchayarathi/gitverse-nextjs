import { NextRequest } from "next/server";
import { validateCsrfOrigin } from "../csrf";

function mockRequest(method: string, headers: Record<string, string>): NextRequest {
  return {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as NextRequest;
}

describe("validateCsrfOrigin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("allows safe methods (GET, HEAD, OPTIONS)", () => {
    const getReq = mockRequest("GET", {});
    const headReq = mockRequest("HEAD", {});
    const optionsReq = mockRequest("OPTIONS", {});

    expect(validateCsrfOrigin(getReq)).toBe(true);
    expect(validateCsrfOrigin(headReq)).toBe(true);
    expect(validateCsrfOrigin(optionsReq)).toBe(true);
  });

  it("allows state-changing methods if Bearer token is present", () => {
    const req = mockRequest("POST", {
      authorization: "Bearer my-jwt-token",
      origin: "https://evil.com",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows matching Origin host", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_URL = "https://gitverse.com";

    const req = mockRequest("POST", {
      origin: "https://gitverse.com",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows matching Referer host", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_URL = "https://gitverse.com";

    const req = mockRequest("POST", {
      referer: "https://gitverse.com/dashboard/repos",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows matching Origin when NEXT_PUBLIC_APP_URL is used", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXTAUTH_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://gitverse-app.com";

    const req = mockRequest("POST", {
      origin: "https://gitverse-app.com",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("blocks mismatched Origin host in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_URL = "https://gitverse.com";

    const req = mockRequest("POST", {
      origin: "https://evil.com",
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("blocks mismatched Referer host in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_URL = "https://gitverse.com";

    const req = mockRequest("POST", {
      referer: "https://evil.com/some-page",
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("blocks missing Origin and Referer in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_URL = "https://gitverse.com";

    const req = mockRequest("POST", {});
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("allows missing Origin and Referer in development", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    const req = mockRequest("POST", {});
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("blocks missing NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const req = mockRequest("POST", {
      origin: "https://gitverse.com",
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("allows missing NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const req = mockRequest("POST", {
      origin: "https://evil.com",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });
});
