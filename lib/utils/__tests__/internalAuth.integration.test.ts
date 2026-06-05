import crypto from "crypto";
import {
  deriveBearerToken,
  validateAuthorizationHeader,
  isInternalWorkerAuthorized,
  isAnalysisRunnerTokenValid,
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

      const queueToken = deriveBearerToken(secret);
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

      expect(validateAuthorizationHeader(`${token} `, secret)).toBe(false);
    });

    it("handles case-sensitive comparison", () => {
      const secret = "valid-secret";
      const token = deriveBearerToken(secret);

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
  });

  describe("isAnalysisRunnerTokenValid", () => {
    it("validates correct runner secret from header", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret-123";
      expect(isAnalysisRunnerTokenValid("runner-secret-123")).toBe(true);
    });

    it("rejects incorrect runner secret", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret-123";
      expect(isAnalysisRunnerTokenValid("wrong-secret")).toBe(false);
    });

    it("rejects when ANALYSIS_RUNNER_SECRET is not set", () => {
      delete process.env.ANALYSIS_RUNNER_SECRET;
      expect(isAnalysisRunnerTokenValid("any-secret")).toBe(false);
    });

    it("rejects null header", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      expect(isAnalysisRunnerTokenValid(null)).toBe(false);
    });
  });

  describe("Security scenarios", () => {
    it("prevents token forgery when secrets are different", () => {
      process.env.JWT_SECRET = "jwt-secret-123";
      process.env.INTERNAL_WORKER_SECRET = "worker-secret-456";

      const forgedToken = deriveBearerToken("jwt-secret-123");
      expect(isInternalWorkerAuthorized(forgedToken)).toBe(false);
    });

    it("allows legitimate internal worker requests", () => {
      process.env.INTERNAL_WORKER_SECRET = "legitimate-worker-secret";

      const queueToken = deriveBearerToken("legitimate-worker-secret");
      expect(isInternalWorkerAuthorized(queueToken)).toBe(true);
    });

    it("handles empty INTERNAL_WORKER_SECRET gracefully", () => {
      process.env.INTERNAL_WORKER_SECRET = "";

      expect(isInternalWorkerAuthorized(null)).toBe(false);
      expect(isInternalWorkerAuthorized("Bearer anything")).toBe(false);
    });

    it("prevents cross-secret authorization", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-specific-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-specific-secret";

      const runnerToken = deriveBearerToken("runner-specific-secret");
      expect(isInternalWorkerAuthorized(runnerToken)).toBe(false);
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

      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});
