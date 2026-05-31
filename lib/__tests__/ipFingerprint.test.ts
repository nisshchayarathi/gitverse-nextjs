import crypto from "crypto";
import { createIpFingerprint } from "@/lib/utils/ipFingerprint";

describe("createIpFingerprint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.IP_FINGERPRINT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.JWT_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns unknown for missing client IPs", () => {
    expect(createIpFingerprint("unknown")).toBe("unknown");
    expect(createIpFingerprint("")).toBe("unknown");
  });

  it("does not fingerprint IPs with a hardcoded fallback secret", () => {
    expect(createIpFingerprint("203.0.113.10")).toBe("unavailable");
  });

  it("uses configured secrets to produce a stable truncated HMAC", () => {
    process.env.NEXTAUTH_SECRET = "configured-secret";

    const expected = crypto
      .createHmac("sha256", "configured-secret")
      .update("203.0.113.10")
      .digest("hex")
      .substring(0, 16);

    expect(createIpFingerprint("203.0.113.10")).toBe(expected);
  });
});
