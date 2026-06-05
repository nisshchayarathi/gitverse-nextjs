// Polyfill globals for NextRequest
if (typeof Request === 'undefined') {
  global.Request = class Request {} as any;
  global.Response = class Response {} as any;
}

import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { getToken } from "next-auth/jwt";

jest.mock("next/server", () => {
  return {
    NextRequest: class MockNextRequest {
      nextUrl: any;
      url: string;
      constructor(url: string) {
        this.url = url;
        const parsed = new URL(url);
        this.nextUrl = {
          pathname: parsed.pathname,
          search: parsed.search,
          searchParams: parsed.searchParams,
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

describe("Edge Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (path: string, search: string = "") => {
    const url = `http://localhost:3000${path}${search}`;
    return new NextRequest(url) as any;
  };

  it("should bypass session auth completely for webhook routes", async () => {
    // Webhook should proceed without any redirects, even if unauthenticated
    (getToken as jest.Mock).mockResolvedValue(null);

    const req = createRequest("/api/integrations/github/webhook");
    const response = await middleware(req);

    expect(response).toBeDefined();
    // NextResponse.next() returns a response with no Location header.
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
});
