import { encryptToken, decryptToken } from "../encryption";

const TEST_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const TEST_KEY_ALT = "0000000000000000000000000000000000000000000000000000000000000000";

describe("encryptToken / decryptToken", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  it("encrypts and then decrypts a token to the original value", () => {
    const original = "ghp_test_token_12345";
    const encrypted = encryptToken(original);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(original);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const token = "same-token-value";
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);
    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptToken(encrypted1)).toBe(token);
    expect(decryptToken(encrypted2)).toBe(token);
  });

  it("handles tokens with special characters", () => {
    const token = "ghx_!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
    const encrypted = encryptToken(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("handles empty-ish but non-empty strings (single char)", () => {
    const token = "a";
    const encrypted = encryptToken(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("throws when decrypting with a different key", () => {
    const encrypted = encryptToken("secret-token");
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY_ALT;
    expect(() => decryptToken(encrypted)).toThrow("Failed to decrypt token");
  });

  it("decrypts with previous key during rotation", () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY_ALT;
    const encrypted = encryptToken("token-under-old-key");
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = TEST_KEY_ALT;
    expect(decryptToken(encrypted)).toBe("token-under-old-key");
  });

  it("throws when TOKEN_ENCRYPTION_KEY is not set", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    expect(() => decryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
  });

  it("throws for malformed hex key (invalid characters)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
    expect(() => encryptToken("test")).toThrow("must be a 64-character hex string");
  });

  it("throws for malformed hex key (short string)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abcdef0123456789";
    expect(() => encryptToken("test")).toThrow("must be a 64-character hex string");
  });

  it("throws for empty input", () => {
    expect(() => encryptToken("")).toThrow("must not be empty");
    expect(() => decryptToken("")).toThrow("must not be empty");
  });
});
