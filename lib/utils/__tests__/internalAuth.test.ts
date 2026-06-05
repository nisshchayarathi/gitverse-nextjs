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
  validateSecretStrength,
} from "../internalAuth";

describe("internalAuth utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("deriveBearerToken", () => {
    it("derives a Bearer token from a secret using SHA-256", () => {
      const secret = "test-secret";
      const hash = crypto.createHash("sha256").update(secret).digest("hex");
      const expected = `Bearer ${hash}`;

      expect(deriveBearerToken(secret)).toBe(expected);
    });

    it("returns different tokens for different secrets", () => {
      const token1 = deriveBearerToken("secret1");
      const token2 = deriveBearerToken("secret2");

      expect(token1).not.toBe(token2);
    });

    it("returns consistent tokens for the same secret", () => {
      const token1 = deriveBearerToken("same-secret");
      const token2 = deriveBearerToken("same-secret");

      expect(token1).toBe(token2);
    });

    it("handles empty string secret", () => {
      const token = deriveBearerToken("");
      const hash = crypto.createHash("sha256").update("").digest("hex");
      expect(token).toBe(`Bearer ${hash}`);
    });
  });

  describe("validateAuthorizationHeader", () => {
    it("returns true for valid authorization header", () => {
      const secret = "valid-secret";
      const token = deriveBearerToken(secret);

      expect(validateAuthorizationHeader(token, secret)).toBe(true);
    });

    it("returns false for invalid authorization header", () => {
      const secret = "valid-secret";
      const invalidToken = "Bearer invalid-hash";

      expect(validateAuthorizationHeader(invalidToken, secret)).toBe(false);
    });

    it("returns false for null authorization header", () => {
      const secret = "valid-secret";

      expect(validateAuthorizationHeader(null, secret)).toBe(false);
    });

    it("returns false for empty secret", () => {
      const token = deriveBearerToken("some-secret");

      expect(validateAuthorizationHeader(token, "")).toBe(false);
    });

    it("uses timing-safe comparison", () => {
      const secret = "test-secret";
      const token = deriveBearerToken(secret);
      expect(validateAuthorizationHeader(token, secret)).toBe(true);
    });
  });

  describe("isInternalWorkerAuthorized", () => {
    it("returns true for valid INTERNAL_WORKER_SECRET", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      const token = deriveBearerToken("worker-secret");

      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });

    it("returns false for invalid token", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";

      expect(isInternalWorkerAuthorized("Bearer invalid")).toBe(false);
    });

    it("returns false when INTERNAL_WORKER_SECRET is not set", () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      const token = deriveBearerToken("any-secret");

      expect(isInternalWorkerAuthorized(token)).toBe(false);
    });
  });

  describe("isCronAuthorized", () => {
    it("returns true for valid CRON_SECRET", () => {
      process.env.CRON_SECRET = "cron-secret";
      const token = deriveBearerToken("cron-secret");

      expect(isCronAuthorized(token)).toBe(true);
    });

    it("falls back to ANALYSIS_RUNNER_SECRET", () => {
      delete process.env.CRON_SECRET;
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      const token = deriveBearerToken("runner-secret");

      expect(isCronAuthorized(token)).toBe(true);
    });

    it("returns false when no secrets are set", () => {
      delete process.env.CRON_SECRET;
      delete process.env.ANALYSIS_RUNNER_SECRET;

      expect(isCronAuthorized("Bearer any-token")).toBe(false);
    });

    it("accepts direct Bearer token for CRON_SECRET", () => {
      process.env.CRON_SECRET = "direct-cron-secret";
      expect(isCronAuthorized("Bearer direct-cron-secret")).toBe(true);
    });

    it("rejects mismatched direct token for CRON_SECRET", () => {
      process.env.CRON_SECRET = "real-cron-secret";
      expect(isCronAuthorized("Bearer wrong-secret")).toBe(false);
    });
  });

  describe("isAnalysisRunnerTokenValid", () => {
    it("returns true when header secret matches env var", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      expect(isAnalysisRunnerTokenValid("runner-secret")).toBe(true);
    });

    it("returns false when header secret does not match", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      expect(isAnalysisRunnerTokenValid("wrong-secret")).toBe(false);
    });

    it("returns false when ANALYSIS_RUNNER_SECRET is not set", () => {
      delete process.env.ANALYSIS_RUNNER_SECRET;
      expect(isAnalysisRunnerTokenValid("any-secret")).toBe(false);
    });

    it("returns false when header secret is null", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      expect(isAnalysisRunnerTokenValid(null)).toBe(false);
    });

    it("returns false when header secret is empty string", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      expect(isAnalysisRunnerTokenValid("")).toBe(false);
    });

    it("uses timing-safe comparison", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "timing-safe-test";
      expect(isAnalysisRunnerTokenValid("timing-safe-test")).toBe(true);
      expect(isAnalysisRunnerTokenValid("TIMING-SAFE-TEST")).toBe(false);
    });

    it("handles secrets with special characters", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "secret!@#$%^&*()";
      expect(isAnalysisRunnerTokenValid("secret!@#$%^&*()")).toBe(true);
    });
  });

  describe("validateRequiredSecrets", () => {
    it("returns empty array when all secrets are set in development", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      process.env.NODE_ENV = "development";

      expect(validateRequiredSecrets()).toEqual([]);
    });

    it("returns missing secrets in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.INTERNAL_WORKER_SECRET;
      delete process.env.ANALYSIS_RUNNER_SECRET;

      const missing = validateRequiredSecrets();
      expect(missing).toContain("INTERNAL_WORKER_SECRET");
      expect(missing).toContain("ANALYSIS_RUNNER_SECRET");
    });

    it("does not require ANALYSIS_RUNNER_SECRET in development", () => {
      process.env.NODE_ENV = "development";
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      delete process.env.ANALYSIS_RUNNER_SECRET;

      const missing = validateRequiredSecrets();
      expect(missing).not.toContain("ANALYSIS_RUNNER_SECRET");
    });
  });

  describe("validateRequiredAnalysisSecrets", () => {
    it("returns error when ANALYSIS_RUNNER_SECRET is not set in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.ANALYSIS_RUNNER_SECRET;

      const result = validateRequiredAnalysisSecrets();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("ANALYSIS_RUNNER_SECRET");
    });

    it("returns warning when ANALYSIS_RUNNER_SECRET is not set in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.ANALYSIS_RUNNER_SECRET;

      const result = validateRequiredAnalysisSecrets();
      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("returns no errors when ANALYSIS_RUNNER_SECRET is set", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "secure-secret-12345";
      const result = validateRequiredAnalysisSecrets();
      expect(result.errors.length).toBe(0);
    });

    it("warns when ANALYSIS_RUNNER_SECRET is shorter than 16 characters", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "short";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("shorter"))).toBe(true);
    });

    it("warns when ANALYSIS_RUNNER_SECRET is a placeholder", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "your_analysis_runner_secret_here";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("placeholder"))).toBe(true);
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals INTERNAL_WORKER_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "shared-secret";
      process.env.INTERNAL_WORKER_SECRET = "shared-secret";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("differ"))).toBe(true);
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals CRON_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "shared-secret";
      process.env.CRON_SECRET = "shared-secret";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("differ"))).toBe(true);
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals JWT_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "shared-secret";
      process.env.JWT_SECRET = "shared-secret";
      const result = validateRequiredAnalysisSecrets();
      expect(result.warnings.some((w) => w.includes("differ"))).toBe(true);
    });

    it("returns no warnings for properly configured secret", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "a-strong-random-secret-12345";
      process.env.INTERNAL_WORKER_SECRET = "different-worker-secret-67890";
      process.env.CRON_SECRET = "different-cron-secret-11111";
      process.env.JWT_SECRET = "different-jwt-secret-22222";

      const result = validateRequiredAnalysisSecrets();
      expect(result.errors.length).toBe(0);
      expect(result.warnings.filter((w) => w.includes("differ")).length).toBe(0);
    });
  });

  describe("validateSecretIsolation", () => {
    it("returns empty array when secrets are properly isolated", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
      process.env.JWT_SECRET = "jwt-secret";
      process.env.ANALYSIS_RUNNER_SECRET = "runner-secret";
      process.env.CRON_SECRET = "cron-secret";

      expect(validateSecretIsolation()).toEqual([]);
    });

    it("warns when INTERNAL_WORKER_SECRET equals GITHUB_WEBHOOK_SECRET", () => {
      process.env.INTERNAL_WORKER_SECRET = "same-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("INTERNAL_WORKER_SECRET should differ from GITHUB_WEBHOOK_SECRET"),
        ])
      );
    });

    it("warns when INTERNAL_WORKER_SECRET equals JWT_SECRET", () => {
      process.env.INTERNAL_WORKER_SECRET = "same-secret";
      process.env.JWT_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("INTERNAL_WORKER_SECRET should differ from JWT_SECRET"),
        ])
      );
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals INTERNAL_WORKER_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "same-secret";
      process.env.INTERNAL_WORKER_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("ANALYSIS_RUNNER_SECRET should differ from INTERNAL_WORKER_SECRET"),
        ])
      );
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals CRON_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "same-secret";
      process.env.CRON_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("ANALYSIS_RUNNER_SECRET should differ from CRON_SECRET"),
        ])
      );
    });

    it("warns when ANALYSIS_RUNNER_SECRET equals JWT_SECRET", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "same-secret";
      process.env.JWT_SECRET = "same-secret";

      const warnings = validateSecretIsolation();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("ANALYSIS_RUNNER_SECRET should differ from JWT_SECRET"),
        ])
      );
    });
  });

  describe("validateSecretStrength", () => {
    it("returns valid for a strong secret", () => {
      const result = validateSecretStrength("strong-secret-12345!@#$%");
      expect(result.valid).toBe(true);
    });

    it("returns error for undefined secret", () => {
      const result = validateSecretStrength(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not set");
    });

    it("returns error for short secret", () => {
      const result = validateSecretStrength("short");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("16 characters");
    });

    it("returns error for common default secrets", () => {
      expect(validateSecretStrength("secret").valid).toBe(false);
      expect(validateSecretStrength("changeme").valid).toBe(false);
      expect(validateSecretStrength("password").valid).toBe(false);
    });

    it("returns error for alphabetic-only secret", () => {
      const result = validateSecretStrength("abcdefghijklmnop");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("numbers and special characters");
    });
  });
});
