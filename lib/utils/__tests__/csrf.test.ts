import { NextRequest } from "next/server";
import { getAllowedOrigins, validateCsrfOrigin } from "../csrf";

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest("https://gitverse.example.com/api/repositories", {
    method: "POST",
  });
  for (const [key, value] of Object.entries(headers)) {
    request.headers.set(key, value);
  }
  return request;
}

describe("csrf", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getAllowedOrigins", () => {
    it("returns empty array when no env vars are set", () => {
      expect(getAllowedOrigins()).toEqual([]);
    });

    it("returns origin from NEXTAUTH_URL", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      expect(getAllowedOrigins()).toEqual(["https://gitverse.example.com"]);
    });

    it("returns origin from NEXT_PUBLIC_API_URL", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.gitverse.example.com";
      expect(getAllowedOrigins()).toEqual(["https://api.gitverse.example.com"]);
    });

    it("returns deduplicated origins from both env vars", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      process.env.NEXT_PUBLIC_API_URL = "https://gitverse.example.com";
      expect(getAllowedOrigins()).toEqual(["https://gitverse.example.com"]);
    });

    it("returns distinct origins from both env vars", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      process.env.NEXT_PUBLIC_API_URL = "https://api.gitverse.example.com";
      expect(getAllowedOrigins()).toEqual([
        "https://gitverse.example.com",
        "https://api.gitverse.example.com",
      ]);
    });

    it("skips invalid URLs", () => {
      process.env.NEXTAUTH_URL = "not-a-valid-url";
      process.env.NEXT_PUBLIC_API_URL = "https://valid.example.com";
      expect(getAllowedOrigins()).toEqual(["https://valid.example.com"]);
    });

    it("trims whitespace from env vars", () => {
      process.env.NEXTAUTH_URL = "  https://gitverse.example.com  ";
      expect(getAllowedOrigins()).toEqual(["https://gitverse.example.com"]);
    });
  });

  describe("validateCsrfOrigin", () => {
    it("allows requests with no Origin header", () => {
      const request = createMockRequest({});
      expect(validateCsrfOrigin(request)).toBe(true);
    });

    it("blocks cross-origin requests when no origins are configured (fail-closed)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const request = createMockRequest({ origin: "https://evil.com" });

      expect(validateCsrfOrigin(request)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CSRF]")
      );
      consoleSpy.mockRestore();
    });

    it("allows requests from configured NEXTAUTH_URL origin", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      const request = createMockRequest({ origin: "https://gitverse.example.com" });

      expect(validateCsrfOrigin(request)).toBe(true);
    });

    it("allows requests from configured NEXT_PUBLIC_API_URL origin", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.gitverse.example.com";
      const request = createMockRequest({ origin: "https://api.gitverse.example.com" });

      expect(validateCsrfOrigin(request)).toBe(true);
    });

    it("blocks requests from unconfigured origins", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const request = createMockRequest({ origin: "https://evil.com" });

      expect(validateCsrfOrigin(request)).toBe(false);
      consoleSpy.mockRestore();
    });

    it("allows same-origin requests (no Origin header) even without config", () => {
      const request = createMockRequest({});
      expect(validateCsrfOrigin(request)).toBe(true);
    });

    it("blocks all cross-origin requests when env vars are empty strings", () => {
      process.env.NEXTAUTH_URL = "";
      process.env.NEXT_PUBLIC_API_URL = "";
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const request = createMockRequest({ origin: "https://evil.com" });

      expect(validateCsrfOrigin(request)).toBe(false);
      consoleSpy.mockRestore();
    });

    it("allows requests from either configured origin", () => {
      process.env.NEXTAUTH_URL = "https://gitverse.example.com";
      process.env.NEXT_PUBLIC_API_URL = "https://api.gitverse.example.com";

      const req1 = createMockRequest({ origin: "https://gitverse.example.com" });
      const req2 = createMockRequest({ origin: "https://api.gitverse.example.com" });

      expect(validateCsrfOrigin(req1)).toBe(true);
      expect(validateCsrfOrigin(req2)).toBe(true);
    });
  });
});
