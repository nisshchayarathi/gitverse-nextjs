import { secretDetector } from "../../lib/services/secret-detector";
import { entropyAnalysis } from "../../lib/services/entropy-analysis";

describe("Secret Exposure Engine", () => {
  it("detects high entropy strings", () => {
    const highEntropy = "aGVsbG8gd29ybGQgYW5kIG1vcmUgdGV4dCB0aGF0IGlzIGJhc2U2NCBlbmNvZGVkIQ==";
    expect(entropyAnalysis.isSuspiciouslyHighEntropy(highEntropy)).toBe(true);
  });

  it("detects AWS keys", async () => {
    // Basic regex check without AI verification (mocking AI or accepting Low severity)
    const result = await secretDetector.scanFile("config.js", "const aws_secret_access_key = 'AKIAIOSFODNN7EXAMPLE'");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].provider).toBe("AWS");
  });

  it("detects Stripe keys", async () => {
    const result = await secretDetector.scanFile("payment.ts", "const key = 'sk_test_abc1234567890def123456789'");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].provider).toBe("Stripe");
  });

  it("masks secrets", async () => {
    const result = await secretDetector.scanFile("payment.ts", "const key = 'sk_test_abc1234567890def123456789'");
    expect(result[0].maskedMatch).not.toContain("abc1234");
    expect(result[0].maskedMatch).toContain("*");
  });
});
