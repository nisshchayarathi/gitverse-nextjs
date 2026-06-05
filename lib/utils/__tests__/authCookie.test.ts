import { getClearCookieHeaders, appendClearCookieHeaders } from "../authCookie";
import { NextResponse } from "next/server";

describe("authCookie", () => {
  describe("getClearCookieHeaders", () => {
    it("returns headers for all three NextAuth cookies", () => {
      const headers = getClearCookieHeaders();
      const setCookie = headers["Set-Cookie"];
      expect(setCookie).toContain("next-auth.session-token=;");
      expect(setCookie).toContain("next-auth.csrf-token=;");
      expect(setCookie).toContain("next-auth.callback-url=;");
    });

    it("sets expiry in the past", () => {
      const headers = getClearCookieHeaders();
      expect(headers["Set-Cookie"]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    });

    it("sets HttpOnly and Secure flags", () => {
      const headers = getClearCookieHeaders();
      expect(headers["Set-Cookie"]).toContain("HttpOnly");
      expect(headers["Set-Cookie"]).toContain("Secure");
    });

    it("includes all three cookie names in the header value", () => {
      const headers = getClearCookieHeaders();
      expect(headers["Set-Cookie"]).toContain("next-auth.session-token=;");
      expect(headers["Set-Cookie"]).toContain("next-auth.csrf-token=;");
      expect(headers["Set-Cookie"]).toContain("next-auth.callback-url=;");
    });
  });

  describe("appendClearCookieHeaders", () => {
    it("appends three Set-Cookie headers to a response", () => {
      const response = NextResponse.json({ ok: true });
      appendClearCookieHeaders(response);
      const setCookieHeaders = response.headers.getSetCookie
        ? response.headers.getSetCookie()
        : [];
      if (setCookieHeaders.length > 0) {
        expect(setCookieHeaders.length).toBe(3);
        expect(setCookieHeaders[0]).toContain("next-auth.session-token=;");
      } else {
        const combined = response.headers.get("Set-Cookie") || "";
        expect(combined).toContain("next-auth.session-token");
        expect(combined).toContain("next-auth.csrf-token");
      }
    });
  });
});
