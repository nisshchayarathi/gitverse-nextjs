/**
 * @jest-environment node
 */

const VALID_HEX_KEY = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const SHORT_KEY = "0001020304050607";
const INVALID_HEX_KEY = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

afterEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("tokenEncryption", () => {
  let mod: typeof import("../tokenEncryption");

  beforeAll(() => {
    mod = require("../tokenEncryption");
  });

  describe("validateEncryptionConfig", () => {
    it("returns invalid when key is not set", () => {
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not set");
    });

    it("returns invalid when key is empty string", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "";
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(false);
    });

    it("returns invalid when key is whitespace only", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "   ";
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(false);
    });

    it("returns invalid when key is too short", () => {
      process.env.TOKEN_ENCRYPTION_KEY = SHORT_KEY;
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be 64");
    });

    it("returns invalid when key contains non-hex characters", () => {
      process.env.TOKEN_ENCRYPTION_KEY = INVALID_HEX_KEY;
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("hex");
    });

    it("returns valid for a proper 64-character hex key", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("trims whitespace from the key before validation", () => {
      process.env.TOKEN_ENCRYPTION_KEY = `  ${VALID_HEX_KEY}  `;
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(true);
    });

    it("accepts uppercase hex characters", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY.toUpperCase();
      const result = mod.validateEncryptionConfig();
      expect(result.valid).toBe(true);
    });
  });

  describe("checkEncryptionHealth", () => {
    it("returns unhealthy when key is missing", () => {
      const result = mod.checkEncryptionHealth();
      expect(result.healthy).toBe(false);
    });

    it("returns healthy when key is valid and round-trip works", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
      const result = mod.checkEncryptionHealth();
      expect(result.healthy).toBe(true);
    });

    it("returns unhealthy when key format is wrong", () => {
      process.env.TOKEN_ENCRYPTION_KEY = SHORT_KEY;
      const result = mod.checkEncryptionHealth();
      expect(result.healthy).toBe(false);
    });
  });

  describe("encryptToken", () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
    });

    it("produces a base64 string", () => {
      const result = mod.encryptToken("gho_test-token-12345");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(() => Buffer.from(result, "base64")).not.toThrow();
    });

    it("produces different ciphertexts for the same plaintext", () => {
      const a = mod.encryptToken("same-token");
      const b = mod.encryptToken("same-token");
      expect(a).not.toBe(b);
    });

    it("throws when key is not set", () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => mod.encryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    });

    it("throws when key is too short", () => {
      process.env.TOKEN_ENCRYPTION_KEY = SHORT_KEY;
      expect(() => mod.encryptToken("test")).toThrow("must be 64");
    });

    it("throws when key contains non-hex characters", () => {
      process.env.TOKEN_ENCRYPTION_KEY = INVALID_HEX_KEY;
      expect(() => mod.encryptToken("test")).toThrow("hex");
    });
  });

  describe("decryptToken", () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
    });

    it("decrypts a token that was encrypted with the same key", () => {
      const original = "gho_my-secret-github-token-abc123";
      const encrypted = mod.encryptToken(original);
      const decrypted = mod.decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it("handles tokens with special characters", () => {
      const original = "ghp_!@#$%^&*()_+-=[]{}|;':\",./<>?`~ token";
      const encrypted = mod.encryptToken(original);
      const decrypted = mod.decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it("handles empty string", () => {
      const encrypted = mod.encryptToken("");
      const decrypted = mod.decryptToken(encrypted);
      expect(decrypted).toBe("");
    });

    it("handles long tokens", () => {
      const original = "x".repeat(10000);
      const encrypted = mod.encryptToken(original);
      const decrypted = mod.decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it("throws when key is not set", () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => mod.decryptToken("dGVzdA==")).toThrow("TOKEN_ENCRYPTION_KEY");
    });

    it("throws when ciphertext auth tag is corrupted", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
      const encrypted = mod.encryptToken("original-token");
      const buf = Buffer.from(encrypted, "base64");
      buf[20] ^= 0xff;
      const corrupted = buf.toString("base64");
      expect(() => mod.decryptToken(corrupted)).toThrow();
    });
  });

  describe("isTokenEncrypted", () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
    });

    it("returns true for an encrypted token", () => {
      const encrypted = mod.encryptToken("some-token");
      expect(mod.isTokenEncrypted(encrypted)).toBe(true);
    });

    it("returns false for a raw base64 string that is too short", () => {
      const short = Buffer.from("short").toString("base64");
      expect(mod.isTokenEncrypted(short)).toBe(false);
    });

    it("returns false for invalid base64", () => {
      expect(mod.isTokenEncrypted("!!!not-base64!!!")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(mod.isTokenEncrypted(null as any)).toBe(false);
      expect(mod.isTokenEncrypted(undefined as any)).toBe(false);
    });
  });

  describe("encrypt-decrypt round trip with multiple keys", () => {
    it("produces consistent results across multiple encrypt-decrypt cycles", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
      const payloads = [
        "gho_single",
        "ghp_" + "a".repeat(40),
        "github_pat_11aabbccddeeff",
        "v2." + Buffer.from("test").toString("base64"),
      ];
      for (const payload of payloads) {
        const encrypted = mod.encryptToken(payload);
        const decrypted = mod.decryptToken(encrypted);
        expect(decrypted).toBe(payload);
      }
    });

    it("fails to decrypt with a different key", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
      const encrypted = mod.encryptToken("secret-token");

      process.env.TOKEN_ENCRYPTION_KEY = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      expect(() => mod.decryptToken(encrypted)).toThrow();
    });
  });
});
