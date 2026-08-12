import { scanAndRedactPayload } from "../geminiService";

const GITHUB_TOKEN = "ghp_123456789012345678901234567890123456";
const GOOGLE_API_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";
const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const SLACK_TOKEN = ["xoxb-123456789012", "123456789012", "abcdefghijklmnopqrstuvwx"].join("-");

describe("lib/services/geminiService scanAndRedactPayload", () => {
  it("throws when a high-confidence GitHub token is present", () => {
    expect(() =>
      scanAndRedactPayload(`reviewing ${GITHUB_TOKEN} in a diff`)
    ).toThrow("High-confidence secret detected");
  });

  it("throws when a Google API key is present", () => {
    expect(() =>
      scanAndRedactPayload(`key: ${GOOGLE_API_KEY}`)
    ).toThrow("High-confidence secret detected");
  });

  it("throws when an AWS access key is present", () => {
    expect(() =>
      scanAndRedactPayload(`aws: ${AWS_ACCESS_KEY}`)
    ).toThrow("High-confidence secret detected");
  });

  it("throws when a Slack token is present", () => {
    expect(() =>
      scanAndRedactPayload(`slack ${SLACK_TOKEN}`)
    ).toThrow("High-confidence secret detected");
  });

  it("still detects a high-confidence secret on repeated calls (stateful regex bug)", () => {
    const payload = `contains ${GITHUB_TOKEN} inside a diff`;

    expect(() => scanAndRedactPayload(payload)).toThrow("High-confidence secret detected");
    // Second call must NOT skip the token because lastIndex leaked from the first call
    expect(() => scanAndRedactPayload(payload)).toThrow("High-confidence secret detected");
  });

  it("still detects a high-confidence secret on the third call", () => {
    const payload = `aws key ${AWS_ACCESS_KEY} here`;
    expect(() => scanAndRedactPayload(payload)).toThrow();
    expect(() => scanAndRedactPayload(payload)).toThrow();
    expect(() => scanAndRedactPayload(payload)).toThrow();
  });

  it("redacts suspected generic secrets", () => {
    const result = scanAndRedactPayload(
      "api_password = 'super-secret-value-12345'"
    );
    expect(result).toContain("[REDACTED_SECRET]");
    expect(result).not.toContain("super-secret-value-12345");
  });

  it("redacts suspected bearer tokens", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.abc.def";
    const result = scanAndRedactPayload(`Authorization: Bearer ${token}`);
    expect(result).toContain("[REDACTED_SECRET]");
    expect(result).not.toContain(token);
  });

  it("redacts multiple suspected tokens in a single payload", () => {
    const result = scanAndRedactPayload(
      `password = 'abcdefghijklmnopqrstuvwxyz0123456789' and api_secret='zyxwvutsrqponmlkjihgfedcba9876543210'`
    );
    expect(result).toContain("[REDACTED_SECRET]");
    expect(result).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
    expect(result).not.toContain("zyxwvutsrqponmlkjihgfedcba9876543210");
  });

  it("leaves safe payloads unchanged", () => {
    const safe = "This diff adds error handling for the repository service.";
    expect(scanAndRedactPayload(safe)).toBe(safe);
  });

  it("leaves short alphanumeric strings untouched", () => {
    const safe = "refactor: rename handleUserClick to handleClick";
    expect(scanAndRedactPayload(safe)).toBe(safe);
  });

  it("handles empty and whitespace payloads", () => {
    expect(scanAndRedactPayload("")).toBe("");
    expect(scanAndRedactPayload("   ")).toBe("   ");
  });
});
