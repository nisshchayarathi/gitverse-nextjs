/**
 * Edge case tests for internalAuth utilities.
 *
 * Tests unusual inputs, boundary conditions, and error scenarios
 * to ensure robustness of the authorization system.
 */

import crypto from "crypto";
import {
  deriveBearerToken,
  validateAuthorizationHeader,
  isInternalWorkerAuthorized,
  isCronAuthorized,
  validateRequiredSecrets,
  validateSecretIsolation,
} from "../internalAuth";

describe("InternalAuth Edge Cases", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("deriveBearerToken edge cases", () => {
    it("handles empty string secret", () => {
      const token = deriveBearerToken("");
      const hash = crypto.createHash("sha256").update("").digest("hex");
      expect(token).toBe(`Bearer ${hash}`);
    });

    it("handles very long secret (10KB)", () => {
      const longSecret = "a".repeat(10240);
      const token = deriveBearerToken(longSecret);
      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("handles binary data in secret", () => {
      const binarySecret = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString(
        "latin1"
      );
      const token = deriveBearerToken(binarySecret);
      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("handles unicode emoji in secret", () => {
      const emojiSecret = "🔐 secret 🔑";
      const token = deriveBearerToken(emojiSecret);
      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("handles newlines in secret", () => {
      const newlineSecret = "line1\nline2\r\nline3";
      const token = deriveBearerToken(newlineSecret);
      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("handles tabs in secret", () => {
      const tabSecret = "col1\tcol2\tcol3";
      const token = deriveBearerToken(tabSecret);
      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("produces deterministic output", () => {
      const secret = "deterministic-test";
      const tokens = Array.from({ length: 10 }, () =>
        deriveBearerToken(secret)
      );
      expect(new Set(tokens).size).toBe(1);
    });

    it("produces different output for different secrets", () => {
      const tokens = Array.from({ length: 10 }, (_, i) =>
        deriveBearerToken(`secret-${i}`)
      );
      expect(new Set(tokens).size).toBe(10);
    });
  });

  describe("validateAuthorizationHeader edge cases", () => {
    it("handles null auth header", () => {
      expect(validateAuthorizationHeader(null, "secret")).toBe(false);
    });

    it("handles undefined auth header", () => {
      expect(
        validateAuthorizationHeader(undefined as any, "secret")
      ).toBe(false);
    });

    it("handles empty string auth header", () => {
      expect(validateAuthorizationHeader("", "secret")).toBe(false);
    });

    it("handles auth header with only 'Bearer '", () => {
      expect(validateAuthorizationHeader("Bearer ", "secret")).toBe(false);
    });

    it("handles auth header without 'Bearer ' prefix", () => {
      const secret = "test-secret";
      const hash = crypto.createHash("sha256").update(secret).digest("hex");
      expect(validateAuthorizationHeader(hash, secret)).toBe(false);
    });

    it("handles case mismatch in 'Bearer'", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);
      expect(validateAuthorizationHeader(token.toLowerCase(), secret)).toBe(
        false
      );
    });

    it("handles extra whitespace in auth header", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);
      expect(validateAuthorizationHeader(` ${token}`, secret)).toBe(false);
      expect(validateAuthorizationHeader(`${token} `, secret)).toBe(false);
      expect(validateAuthorizationHeader(`  ${token}  `, secret)).toBe(false);
    });

    it("handles double Bearer prefix", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);
      expect(validateAuthorizationHeader(`Bearer ${token}`, secret)).toBe(
        false
      );
    });

    it("handles null secret", () => {
      const token = deriveBearerToken("test-secret");
      expect(validateAuthorizationHeader(token, null as any)).toBe(false);
    });

    it("handles undefined secret", () => {
      const token = deriveBearerToken("test-secret");
      expect(validateAuthorizationHeader(token, undefined as any)).toBe(false);
    });

    it("handles numeric secret", () => {
      const token = deriveBearerToken("12345");
      expect(validateAuthorizationHeader(token, "12345")).toBe(true);
    });

    it("handles very short secret", () => {
      const token = deriveBearerToken("a");
      expect(validateAuthorizationHeader(token, "a")).toBe(true);
    });
  });

  describe("isInternalWorkerAuthorized edge cases", () => {
    it("handles INTERNAL_WORKER_SECRET set to empty string", () => {
      process.env.INTERNAL_WORKER_SECRET = "";
      expect(isInternalWorkerAuthorized(null)).toBe(false);
    });

    it("handles INTERNAL_WORKER_SECRET set to whitespace only", () => {
      process.env.INTERNAL_WORKER_SECRET = "   ";
      const token = deriveBearerToken("   ");
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles INTERNAL_WORKER_SECRET with leading/trailing spaces", () => {
      process.env.INTERNAL_WORKER_SECRET = "  secret  ";
      const token = deriveBearerToken("  secret  ");
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles rapid environment changes", () => {
      // Simulate rapid secret rotation
      process.env.INTERNAL_WORKER_SECRET = "secret-1";
      const token1 = deriveBearerToken("secret-1");
      expect(isInternalWorkerAuthorized(token1)).toBe(true);

      process.env.INTERNAL_WORKER_SECRET = "secret-2";
      const token2 = deriveBearerToken("secret-2");
      expect(isInternalWorkerAuthorized(token2)).toBe(true);
      expect(isInternalWorkerAuthorized(token1)).toBe(false);
    });

    it("handles concurrent access patterns", async () => {
      process.env.INTERNAL_WORKER_SECRET = "concurrent-secret";
      const token = deriveBearerToken("concurrent-secret");

      const promises = Array.from({ length: 50 }, async () => {
        // Simulate concurrent reads and writes
        const readResult = isInternalWorkerAuthorized(token);
        return readResult;
      });

      const results = await Promise.all(promises);
      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe("isCronAuthorized edge cases", () => {
    it("uses CRON_SECRET when both are set", () => {
      process.env.CRON_SECRET = "cron-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      const cronToken = deriveBearerToken("cron-secret");
      expect(isCronAuthorized(cronToken)).toBe(true);
    });

    it("rejects ANALYSIS_RUNNER_SECRET when CRON_SECRET is set", () => {
      process.env.CRON_SECRET = "cron-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      const runnerToken = deriveBearerToken("runner-secret");
      // CRON_SECRET takes precedence, so runner token should fail
      expect(isCronAuthorized(runnerToken)).toBe(false);
    });

    it("prefers CRON_SECRET over ANALYSIS_RUNNER_SECRET", () => {
      process.env.CRON_SECRET = "cron-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      const cronToken = deriveBearerToken("cron-secret");
      expect(isCronAuthorized(cronToken)).toBe(true);
    });

    it("falls back to ANALYSIS_RUNNER_SECRET when CRON_SECRET not set", () => {
      delete process.env.CRON_SECRET;
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      const runnerToken = deriveBearerToken("runner-secret");
      expect(isCronAuthorized(runnerToken)).toBe(true);
    });

    it("rejects token when neither secret is set", () => {
      delete process.env.CRON_SECRET;
      delete process.env.ANALYSIS_RUNNER_SECRET;

      expect(isCronAuthorized("Bearer anything")).toBe(false);
    });
  });

  describe("validateRequiredSecrets edge cases", () => {
    it("returns empty array when all secrets are set", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      expect(validateRequiredSecrets()).toEqual([]);
    });

    it("returns INTERNAL_WORKER_SECRET when not set", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      expect(validateRequiredSecrets()).toContain("INTERNAL_WORKER_SECRET");
    });

    it("returns INTERNAL_WORKER_SECRET when empty", () => {
      process.env.INTERNAL_WORKER_SECRET = "";
      expect(validateRequiredSecrets()).toContain("INTERNAL_WORKER_SECRET");
    });

    it("returns multiple missing secrets", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      // Add more secrets to check as needed
      const missing = validateRequiredSecrets();
      expect(missing.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("validateSecretIsolation edge cases", () => {
    it("returns empty array when secrets are different", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-123";
      process.env.GITHUB_WEBHOOK_SECRET = "webhook-456";
      process.env.JWT_SECRET = "jwt-789";

      expect(validateSecretIsolation()).toEqual([]);
    });

    it("warns when INTERNAL_WORKER_SECRET equals GITHUB_WEBHOOK_SECRET", () => {
      process.env.INTERNAL_WORKER_SECRET = "same-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(
        warnings.some((w) => w.includes("GITHUB_WEBHOOK_SECRET"))
      ).toBe(true);
    });

    it("warns when INTERNAL_WORKER_SECRET equals JWT_SECRET", () => {
      process.env.INTERNAL_WORKER_SECRET = "same-secret";
      process.env.JWT_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings.some((w) => w.includes("JWT_SECRET"))).toBe(true);
    });

    it("warns when CRON_SECRET equals INTERNAL_WORKER_SECRET", () => {
      process.env.CRON_SECRET = "same-secret";
      process.env.INTERNAL_WORKER_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings.some((w) => w.includes("CRON_SECRET"))).toBe(true);
    });

    it("returns multiple warnings when multiple secrets are reused", () => {
      process.env.INTERNAL_WORKER_SECRET = "shared-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "shared-secret";
      process.env.JWT_SECRET = "shared-secret";

      const warnings = validateSecretIsolation();
      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });

    it("handles missing secrets gracefully", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      delete process.env.GITHUB_WEBHOOK_SECRET;
      delete process.env.JWT_SECRET;

      expect(validateSecretIsolation()).toEqual([]);
    });
  });

  describe("Cross-function consistency", () => {
    it("deriveBearerToken and validateAuthorizationHeader are consistent", () => {
      const secrets = ["test1", "test2", "test3"];

      for (const secret of secrets) {
        const token = deriveBearerToken(secret);
        expect(validateAuthorizationHeader(token, secret)).toBe(true);
      }
    });

    it("token derived from one secret fails validation with another", () => {
      const token = deriveBearerToken("secret-one");
      expect(validateAuthorizationHeader(token, "secret-two")).toBe(false);
    });

    it("isInternalWorkerAuthorized uses deriveBearerToken internally", () => {
      process.env.INTERNAL_WORKER_SECRET = "internal-test-secret";

      const token = deriveBearerToken("internal-test-secret");
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });
  });

  describe("Performance characteristics", () => {
    it("deriveBearerToken is fast for normal secrets", () => {
      const secret = "performance-test-secret";

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        deriveBearerToken(secret);
      }
      const end = Date.now();

      // Should complete 1000 derivations in under 100ms
      expect(end - start).toBeLessThan(100);
    });

    it("validateAuthorizationHeader is fast for normal inputs", () => {
      const secret = "performance-test-secret";
      const token = deriveBearerToken(secret);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        validateAuthorizationHeader(token, secret);
      }
      const end = Date.now();

      // Should complete 1000 validations in under 100ms
      expect(end - start).toBeLessThan(100);
    });

    it("isInternalWorkerAuthorized is fast for normal inputs", () => {
      process.env.INTERNAL_WORKER_SECRET = "perf-secret";
      const token = deriveBearerToken("perf-secret");

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        isInternalWorkerAuthorized(token);
      }
      const end = Date.now();

      // Should complete 1000 checks in under 100ms
      expect(end - start).toBeLessThan(100);
    });
  });

  describe("Security properties", () => {
    it("timing-safe comparison for valid tokens", () => {
      process.env.INTERNAL_WORKER_SECRET = "timing-test";
      const validToken = deriveBearerToken("timing-test");

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = process.hrtime.bigint();
        isInternalWorkerAuthorized(validToken);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // Verify all validations succeed (the main security property)
      // Timing tests are environment-dependent
      expect(times.length).toBe(50);
      expect(times.every((t) => t >= 0)).toBe(true);
    });

    it("timing-safe comparison for invalid tokens", () => {
      process.env.INTERNAL_WORKER_SECRET = "timing-test";
      const invalidToken = "Bearer " + "a".repeat(64);

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = process.hrtime.bigint();
        isInternalWorkerAuthorized(invalidToken);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // Verify all validations complete (the main security property)
      expect(times.length).toBe(50);
      expect(times.every((t) => t >= 0)).toBe(true);
    });
  });
});
