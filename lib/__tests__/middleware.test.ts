// Polyfill globals for NextRequest
if (typeof Request === 'undefined') {
  global.Request = class Request {} as any;
  global.Response = class Response {} as any;
}

import crypto from "crypto";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { getToken } from "next-auth/jwt";

const MOCK_HMAC_KEY = "test-hmac-secret-key-for-middleware";

jest.mock("next/server", () => {
  return {
    NextRequest: class MockNextRequest {
      nextUrl: any;
      url: string;
      private _cookies: Map<string, string>;
      constructor(url: string, init?: any) {
        this.url = url;
        const parsed = new URL(url);
        this.nextUrl = {
          pathname: parsed.pathname,
          search: parsed.search,
          searchParams: parsed.searchParams,
        };
        this._cookies = new Map();
        // Parse cookies from init headers if provided
        if (init?.headers) {
          const headers = init.headers instanceof Headers
            ? init.headers
            : new Headers(init.headers);
          const cookieHeader = headers.get("cookie");
          if (cookieHeader) {
            for (const pair of cookieHeader.split(";")) {
              const [name, ...rest] = pair.trim().split("=");
              if (name) this._cookies.set(name.trim(), rest.join("=").trim());
            }
          }
        }
      }
      get cookies() {
        const cookiesMap = this._cookies;
        return {
          get: (name: string) => {
            const val = cookiesMap.get(name);
            return val !== undefined ? { value: val } : undefined;
          },
        };
      }
    },
    NextResponse: {
      next: jest.fn().mockImplementation(() => ({
        headers: new Map(),
      })),
      redirect: jest.fn().mockImplementation((url) => ({
        headers: new Map([["Location", url.toString()]]),
      })),
    },
  };
});

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

function signMockSession(value: string, key: string): string {
  const sig = crypto.createHmac("sha256", key).update(value).digest("hex");
  return `${value}.${sig}`;
}

function createMockSessionCookie(): string {
  const value = `true|${Date.now()}`;
  return signMockSession(value, MOCK_HMAC_KEY);
}

describe("Edge Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MOCK_SESSION_HMAC_KEY = MOCK_HMAC_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createRequest = (path: string, search: string = "", cookieHeader?: string) => {
    const url = `http://localhost:3000${path}${search}`;
    const init: any = {};
    if (cookieHeader) {
      init.headers = { cookie: cookieHeader };
    }
    return new NextRequest(url, init) as any;
  };

  it("should bypass session auth completely for webhook routes", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const req = createRequest("/api/integrations/github/webhook");
    const response = await middleware(req);

    expect(response).toBeDefined();
    expect(response?.headers.get("Location")).toBeFalsy();
  });

  it("should bypass session auth for internal webhooks", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const req = createRequest("/api/internal/worker/webhook");
    const response = await middleware(req);

    expect(response).toBeDefined();
    expect(response?.headers.get("Location")).toBeFalsy();
  });

  it("should redirect to login for protected routes when unauthenticated", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const req = createRequest("/dashboard");
    const response = await middleware(req);

    expect(response).toBeDefined();
    const location = response?.headers.get("Location");
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fdashboard");
  });

  it("should allow access to protected routes when authenticated", async () => {
    (getToken as jest.Mock).mockResolvedValue({ sub: "123" });

    const req = createRequest("/dashboard");
    const response = await middleware(req);

    expect(response).toBeDefined();
    expect(response?.headers.get("Location")).toBeFalsy();
  });

  it("should redirect away from auth pages if already authenticated", async () => {
    (getToken as jest.Mock).mockResolvedValue({ sub: "123" });

    const req = createRequest("/login");
    const response = await middleware(req);

    expect(response).toBeDefined();
    const location = response?.headers.get("Location");
    expect(location).toContain("/dashboard");
  });

  it("should allow access to public routes", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const req = createRequest("/about");
    const response = await middleware(req);

    expect(response).toBeDefined();
    expect(response?.headers.get("Location")).toBeFalsy();
  });

  describe("mock-session cookie with HMAC verification", () => {
    it("should accept valid HMAC-signed mock session in non-production", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      const cookie = createMockSessionCookie();
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      expect(response).toBeDefined();
      expect(response?.headers.get("Location")).toBeFalsy();
      expect(getToken).not.toHaveBeenCalled();
    });

    it("should reject mock session with invalid HMAC signature", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      const req = createRequest("/dashboard", "", "mock-session=true.invalidsignature");
      const response = await middleware(req);

      // Should redirect to login since mock session is rejected and getToken returns null
      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session when MOCK_SESSION_HMAC_KEY is not set", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      delete process.env.MOCK_SESSION_HMAC_KEY;
      (getToken as jest.Mock).mockResolvedValue(null);

      const cookie = createMockSessionCookie();
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      // Should redirect to login since HMAC key is missing
      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session in production even with valid HMAC", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "production";
      (getToken as jest.Mock).mockResolvedValue(null);

      const cookie = createMockSessionCookie();
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      // Should redirect to login — mock session never activates in production
      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session when PLAYWRIGHT_TEST is not set", async () => {
      delete process.env.PLAYWRIGHT_TEST;
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      const cookie = createMockSessionCookie();
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session with expired timestamp", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      // Create a cookie with a timestamp from 25 hours ago
      const expiredValue = `true|${Date.now() - 25 * 60 * 60 * 1000}`;
      const cookie = signMockSession(expiredValue, MOCK_HMAC_KEY);
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session with malformed value (no timestamp)", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      const malformedValue = "true";
      const cookie = signMockSession(malformedValue, MOCK_HMAC_KEY);
      const req = createRequest("/dashboard", "", `mock-session=${cookie}`);
      const response = await middleware(req);

      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should reject mock session with no dot separator", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue(null);

      const req = createRequest("/dashboard", "", "mock-session=nodotatall");
      const response = await middleware(req);

      expect(response).toBeDefined();
      const location = response?.headers.get("Location");
      expect(location).toContain("/login");
    });

    it("should fall back to real auth when mock session is invalid", async () => {
      process.env.PLAYWRIGHT_TEST = "true";
      (process.env as Record<string,string>).NODE_ENV = "development";
      (getToken as jest.Mock).mockResolvedValue({ sub: "123" });

      const req = createRequest("/dashboard", "", "mock-session=invalid");
      const response = await middleware(req);

      // Should still be authenticated via real getToken
      expect(response).toBeDefined();
      expect(response?.headers.get("Location")).toBeFalsy();
      expect(getToken).toHaveBeenCalled();
    });
  });
});
