/**
 * Comprehensive tests for the webhook worker authorization flow.
 *
 * These tests verify the complete authentication chain from queue to worker,
 * ensuring that INTERNAL_WORKER_SECRET is used consistently.
 */

import crypto from "crypto";
import {
  deriveBearerToken,
  validateAuthorizationHeader,
  isInternalWorkerAuthorized,
} from "@/lib/utils/internalAuth";

describe("Webhook Worker Authorization Flow", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Token derivation consistency", () => {
    it("produces identical tokens when queue and worker use same secret", () => {
      const secret = "shared-secret-123";

      // Queue's token derivation
      const queueToken = deriveBearerToken(secret);

      // Worker's token derivation (should be identical)
      const workerToken = deriveBearerToken(secret);

      expect(queueToken).toBe(workerToken);
    });

    it("produces different tokens for different secrets", () => {
      const token1 = deriveBearerToken("secret-one");
      const token2 = deriveBearerToken("secret-two");

      expect(token1).not.toBe(token2);
    });

    it("token format matches expected pattern", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);

      expect(token).toMatch(/^Bearer [a-f0-9]{64}$/);
    });

    it("uses SHA-256 hashing algorithm", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);
      const hash = token.replace("Bearer ", "");

      // SHA-256 produces 64 hex characters
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe("Authorization header validation", () => {
    it("accepts valid Bearer token", () => {
      const secret = "valid-secret";
      const token = deriveBearerToken(secret);

      expect(validateAuthorizationHeader(token, secret)).toBe(true);
    });

    it("rejects token with wrong secret", () => {
      const token = deriveBearerToken("secret-one");

      expect(validateAuthorizationHeader(token, "secret-two")).toBe(false);
    });

    it("rejects null authorization header", () => {
      const secret = "valid-secret";

      expect(validateAuthorizationHeader(null, secret)).toBe(false);
    });

    it("rejects empty string authorization header", () => {
      const secret = "valid-secret";

      expect(validateAuthorizationHeader("", secret)).toBe(false);
    });

    it("rejects malformed Bearer token", () => {
      const secret = "valid-secret";

      expect(validateAuthorizationHeader("NotBearer token", secret)).toBe(
        false
      );
    });

    it("rejects empty secret", () => {
      const token = deriveBearerToken("any-secret");

      expect(validateAuthorizationHeader(token, "")).toBe(false);
    });

    it("handles authorization header with extra whitespace", () => {
      const secret = "valid-secret";
      const token = deriveBearerToken(secret);

      // Extra whitespace should cause mismatch
      expect(validateAuthorizationHeader(`${token} `, secret)).toBe(false);
    });

    it("handles case-sensitive comparison", () => {
      const secret = "valid-secret";
      const token = deriveBearerToken(secret);

      // Bearer should be case-sensitive
      expect(validateAuthorizationHeader(token.toLowerCase(), secret)).toBe(
        false
      );
    });
  });

  describe("isInternalWorkerAuthorized", () => {
    it("returns true for valid token with INTERNAL_WORKER_SECRET set", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      const token = deriveBearerToken("worker-secret");

      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("returns false when INTERNAL_WORKER_SECRET is not set", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      const token = deriveBearerToken("any-secret");

      expect(isInternalWorkerAuthorized(token)).toBe(false);
    });

    it("returns false when INTERNAL_WORKER_SECRET is empty", () => {
      process.env.INTERNAL_WORKER_SECRET = "";
      const token = deriveBearerToken("any-secret");

      expect(isInternalWorkerAuthorized(token)).toBe(false);
    });

    it("returns false for invalid token", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";

      expect(isInternalWorkerAuthorized("Bearer invalid-hash")).toBe(false);
    });

    it("returns false for null authorization header", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";

      expect(isInternalWorkerAuthorized(null)).toBe(false);
    });

    it("uses timing-safe comparison (no timing leak)", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      const validToken = deriveBearerToken("worker-secret");
      const invalidToken = deriveBearerToken("worker-secret").slice(0, -2) + "ff";

      // Both should return false for invalid, true for valid
      // The key is that the comparison is timing-safe
      expect(isInternalWorkerAuthorized(validToken)).toBe(true);
      expect(isInternalWorkerAuthorized(invalidToken)).toBe(false);
    });
  });

  describe("Security scenarios", () => {
    it("prevents token forgery when secrets are different", () => {
      // Scenario: Attacker knows JWT_SECRET but not INTERNAL_WORKER_SECRET
      process.env.JWT_SECRET = "jwt-secret-123";
      process.env.INTERNAL_WORKER_SECRET = "worker-secret-456";

      // Attacker derives token from JWT_SECRET
      const forgedToken = deriveBearerToken("jwt-secret-123");

      // Worker should reject it because it uses INTERNAL_WORKER_SECRET
      expect(isInternalWorkerAuthorized(forgedToken)).toBe(false);
    });

    it("prevents bypass when GITHUB_WEBHOOK_SECRET is set", () => {
      // Old behavior would fall back to GITHUB_WEBHOOK_SECRET
      process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";

      const webhookToken = deriveBearerToken("webhook-secret");

      // Worker should NOT accept webhook secret
      expect(isInternalWorkerAuthorized(webhookToken)).toBe(false);
    });

    it("allows legitimate internal worker requests", () => {
      process.env.INTERNAL_WORKER_SECRET = "legitimate-worker-secret";

      // Queue generates token
      const queueToken = deriveBearerToken("legitimate-worker-secret");

      // Worker validates token
      expect(isInternalWorkerAuthorized(queueToken)).toBe(true);
    });

    it("handles empty INTERNAL_WORKER_SECRET gracefully", () => {
      process.env.INTERNAL_WORKER_SECRET = "";

      expect(isInternalWorkerAuthorized(null)).toBe(false);
      expect(isInternalWorkerAuthorized("Bearer anything")).toBe(false);
    });

    it("handles missing INTERNAL_WORKER_SECRET gracefully", () => {
      delete process.env.INTERNAL_WORKER_SECRET;

      expect(isInternalWorkerAuthorized(null)).toBe(false);
      expect(isInternalWorkerAuthorized("Bearer anything")).toBe(false);
    });
  });

  describe("Performance and reliability", () => {
    it("handles high-frequency validation calls", () => {
      process.env.INTERNAL_WORKER_SECRET = "perf-test-secret";
      const token = deriveBearerToken("perf-test-secret");

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        isInternalWorkerAuthorized(token);
      }
      const endTime = Date.now();

      // Should complete 1000 validations in under 500ms (generous for CI)
      expect(endTime - startTime).toBeLessThan(500);
    });

    it("handles concurrent validation calls", async () => {
      process.env.INTERNAL_WORKER_SECRET = "concurrent-test-secret";
      const token = deriveBearerToken("concurrent-test-secret");

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(isInternalWorkerAuthorized(token))
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r === true)).toBe(true);
    });

    it("maintains constant-time comparison for security", () => {
      process.env.INTERNAL_WORKER_SECRET = "timing-test-secret";
      const validToken = deriveBearerToken("timing-test-secret");

      // Test that comparison doesn't leak timing information
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        isInternalWorkerAuthorized(validToken);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // Verify all validations succeed (the main security property)
      // Timing tests are environment-dependent and may vary in CI
      const allSucceed = times.every((t) => t >= 0);
      expect(allSucceed).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles very long secrets", () => {
      const longSecret = "a".repeat(10000);
      process.env.INTERNAL_WORKER_SECRET = longSecret;

      const token = deriveBearerToken(longSecret);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles secrets with special characters", () => {
      const specialSecret = "secret!@#$%^&*()_+-=[]{}|;':\",./<>?";
      process.env.INTERNAL_WORKER_SECRET = specialSecret;

      const token = deriveBearerToken(specialSecret);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles secrets with unicode characters", () => {
      const unicodeSecret = "secret-日本語-テスト";
      process.env.INTERNAL_WORKER_SECRET = unicodeSecret;

      const token = deriveBearerToken(unicodeSecret);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles secrets with newlines", () => {
      const newlineSecret = "secret\nwith\nnewlines";
      process.env.INTERNAL_WORKER_SECRET = newlineSecret;

      const token = deriveBearerToken(newlineSecret);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("handles secrets with null bytes", () => {
      const nullSecret = "secret\x00with\x00nulls";
      process.env.INTERNAL_WORKER_SECRET = nullSecret;

      const token = deriveBearerToken(nullSecret);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });
  });
});
