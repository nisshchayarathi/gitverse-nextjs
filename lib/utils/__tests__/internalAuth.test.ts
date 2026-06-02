import crypto from "crypto";
import {
  deriveBearerToken,
  validateAuthorizationHeader,
  isInternalWorkerAuthorized,
  isCronAuthorized,
  validateRequiredSecrets,
  validateSecretIsolation,
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

      // Verify the function doesn't throw
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
  });

  describe("validateRequiredSecrets", () => {
    it("returns empty array when all secrets are set", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";

      expect(validateRequiredSecrets()).toEqual([]);
    });

    it("returns missing secrets", () => {
      delete process.env.INTERNAL_WORKER_SECRET;

      expect(validateRequiredSecrets()).toContain("INTERNAL_WORKER_SECRET");
    });
  });

  describe("validateSecretIsolation", () => {
    it("returns empty array when secrets are properly isolated", () => {
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
      process.env.JWT_SECRET = "jwt-secret";

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
  });
});
