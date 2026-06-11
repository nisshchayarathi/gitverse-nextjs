import crypto from "crypto";
import {
  deriveBearerToken,
  validateAuthorizationHeader,
  isInternalWorkerAuthorized,
  isCronAuthorized,
  isAnalysisRunnerTokenValid,
  validateRequiredSecrets,
  validateRequiredAnalysisSecrets,
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

    it("handles rapid environment changes", () => {
      process.env.INTERNAL_WORKER_SECRET = "secret-1";
      const token1 = deriveBearerToken("secret-1");
      expect(isInternalWorkerAuthorized(token1)).toBe(true);

      process.env.INTERNAL_WORKER_SECRET = "secret-2";
      const token2 = deriveBearerToken("secret-2");
      expect(isInternalWorkerAuthorized(token2)).toBe(true);
      expect(isInternalWorkerAuthorized(token1)).toBe(false);
    });
  });

  describe("isCronAuthorized edge cases", () => {
    it("uses CRON_SECRET when both are set", () => {
      process.env.CRON_SECRET = "cron-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      const cronToken = deriveBearerToken("cron-secret");
      expect(isCronAuthorized(cronToken)).toBe(true);
    });

    it("also accepts direct CRON_SECRET token", () => {
      process.env.CRON_SECRET = "cron-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";

      expect(isCronAuthorized("Bearer cron-secret")).toBe(true);
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

  describe("isAnalysisRunnerTokenValid edge cases", () => {
    it("returns true for matching secret", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "test-runner-secret";
      expect(isAnalysisRunnerTokenValid("test-runner-secret")).toBe(true);
    });

    it("returns false for non-matching secret", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "real-secret";
      expect(isAnalysisRunnerTokenValid("wrong-secret")).toBe(false);
    });

    it("returns false when env var not set", () => {
      delete process.env.ANALYSIS_RUNNER_SECRET;
      expect(isAnalysisRunnerTokenValid("any-secret")).toBe(false);
    });

    it("returns false for null input", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "some-secret";
      expect(isAnalysisRunnerTokenValid(null)).toBe(false);
    });

    it("returns false for empty input", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "some-secret";
      expect(isAnalysisRunnerTokenValid("")).toBe(false);
    });

    it("handles case sensitivity", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "CaseSensitiveSecret";
      expect(isAnalysisRunnerTokenValid("CaseSensitiveSecret")).toBe(true);
      expect(isAnalysisRunnerTokenValid("casesensitivesecret")).toBe(false);
    });
  });

  describe("validateRequiredSecrets edge cases", () => {
    it("returns empty array when all secrets are set", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      (process.env as any).NODE_ENV = "development";
      expect(validateRequiredSecrets()).toEqual([]);
    });

    it("returns INTERNAL_WORKER_SECRET when not set", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      expect(validateRequiredSecrets()).toContain("INTERNAL_WORKER_SECRET");
    });

    it("returns ANALYSIS_RUNNER_SECRET when not set in production", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      delete process.env.ANALYSIS_RUNNER_SECRET;
      expect(validateRequiredSecrets()).toContain("ANALYSIS_RUNNER_SECRET");
    });
  });

  describe("validateRequiredAnalysisSecrets edge cases", () => {
    it("returns warnings for common default secrets", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "changeme";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("placeholder"))).toBe(true);
    });

    it("returns warnings for short secrets", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "abc";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("shorter"))).toBe(true);
    });
  });

  describe("validateSecretIsolation edge cases", () => {
    it("returns empty array when secrets are different", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-123";
      process.env.GITHUB_WEBHOOK_SECRET = "webhook-456";
      process.env.JWT_SECRET = "jwt-789";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-000";
      process.env.CRON_SECRET = "cron-111";

      expect(validateSecretIsolation()).toEqual([]);
    });

    it("warns when multiple secrets are reused", () => {
      process.env.INTERNAL_WORKER_SECRET = "shared-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "shared-secret";
      process.env.JWT_SECRET = "shared-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "shared-secret";

      const warnings = validateSecretIsolation();
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });

    it("handles missing secrets gracefully", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      delete process.env.GITHUB_WEBHOOK_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.ANALYSIS_RUNNER_SECRET;

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
  });
});
