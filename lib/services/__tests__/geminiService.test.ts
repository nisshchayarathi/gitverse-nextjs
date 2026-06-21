import { scanAndRedactPayload } from "../geminiService";

describe("scanAndRedactPayload", () => {
  it("should block payloads containing high-confidence secrets", () => {
    const mockGithubToken = "ghp_123456789012345678901234567890123456";
    expect(() => scanAndRedactPayload(`Here is a token: ${mockGithubToken}`)).toThrow(
      "High-confidence secret detected"
    );
  });

  it("should not leak lastIndex state between invocations", () => {
    const mockGithubToken1 = "ghp_111111111111111111111111111111111111";
    const mockGithubToken2 = "ghp_222222222222222222222222222222222222";

    // First, trigger a secret match in the middle/end of a long payload
    const longPayload = "a".repeat(1000) + " " + mockGithubToken1;
    expect(() => scanAndRedactPayload(longPayload)).toThrow("High-confidence secret detected");

    // Second, trigger a secret match at the very beginning of a new payload
    // If the RegExp lastIndex is leaked/stale, it would start scanning at index >1000
    // and completely skip mockGithubToken2 at the beginning.
    const newPayload = mockGithubToken2 + " " + "b".repeat(1000);
    expect(() => scanAndRedactPayload(newPayload)).toThrow("High-confidence secret detected");
  });

  it("should pass clean payloads untouched", () => {
    const cleanPayload = "This is a completely clean payload with no secrets.";
    expect(scanAndRedactPayload(cleanPayload)).toBe(cleanPayload);
  });

  it("should redact suspected secrets (e.g. bearer tokens or passwords)", () => {
    const payload = "Authorization: bearer my-secret-bearer-token-12345";
    const result = scanAndRedactPayload(payload);
    expect(result).toContain("[REDACTED_SECRET]");
    expect(result).not.toContain("my-secret-bearer-token-12345");
  });
});
