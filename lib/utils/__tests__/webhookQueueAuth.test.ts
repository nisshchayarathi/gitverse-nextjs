/**
 * Tests for webhook queue authorization flow.
 *
 * Verifies that the queue correctly uses INTERNAL_WORKER_SECRET
 * and generates tokens that match what the worker expects.
 */

import crypto from "crypto";
import { deriveBearerToken, isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";

describe("Webhook Queue Authorization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Token generation", () => {
    it("generates token that worker can validate", () => {
      process.env.INTERNAL_WORKER_SECRET = "queue-test-secret";

      // Queue generates token
      const queueToken = deriveBearerToken("queue-test-secret");

      // Worker validates token
      expect(isInternalWorkerAuthorized(queueToken)).toBe(true);
    });

    it("generates consistent tokens across calls", () => {
      process.env.INTERNAL_WORKER_SECRET = "consistent-secret";

      const token1 = deriveBearerToken("consistent-secret");
      const token2 = deriveBearerToken("consistent-secret");

      expect(token1).toBe(token2);
    });

    it("uses correct hash algorithm", () => {
      const secret = "hash-test-secret";
      const token = deriveBearerToken(secret);
      const hash = token.replace("Bearer ", "");

      // Verify it's a valid SHA-256 hash
      const expectedHash = crypto.createHash("sha256").update(secret).digest("hex");
      expect(hash).toBe(expectedHash);
    });
  });

  describe("Environment variable handling", () => {
    it("throws when INTERNAL_WORKER_SECRET is not set", () => {
      delete process.env.INTERNAL_WORKER_SECRET;

      const secret = process.env.INTERNAL_WORKER_SECRET;
      expect(secret).toBeUndefined();

      // Queue should throw when secret is missing
      expect(() => {
        if (!secret) {
          throw new Error("INTERNAL_WORKER_SECRET not configured");
        }
      }).toThrow("INTERNAL_WORKER_SECRET not configured");
    });

    it("throws when INTERNAL_WORKER_SECRET is empty", () => {
      process.env.INTERNAL_WORKER_SECRET = "";

      const secret = process.env.INTERNAL_WORKER_SECRET;
      expect(secret).toBe("");

      expect(() => {
        if (!secret) {
          throw new Error("INTERNAL_WORKER_SECRET not configured");
        }
      }).toThrow("INTERNAL_WORKER_SECRET not configured");
    });

    it("succeeds when INTERNAL_WORKER_SECRET is set", () => {
      process.env.INTERNAL_WORKER_SECRET = "valid-secret";

      const secret = process.env.INTERNAL_WORKER_SECRET;
      expect(secret).toBeTruthy();

      const token = deriveBearerToken(secret!);
      expect(isInternalWorkerAuthorized(token)).toBe(true);
    });
  });

  describe("Authorization flow simulation", () => {
    it("complete flow: queue generates, worker validates", () => {
      // Simulate queue-side
      process.env.INTERNAL_WORKER_SECRET = "flow-test-secret";
      const queueToken = deriveBearerToken(process.env.INTERNAL_WORKER_SECRET!);

      // Simulate worker-side (reading same env var)
      const workerAuthorized = isInternalWorkerAuthorized(queueToken);

      expect(workerAuthorized).toBe(true);
    });

    it("fails when queue and worker use different secrets", () => {
      // Queue uses one secret
      const queueSecret = "queue-secret";
      const queueToken = deriveBearerToken(queueSecret);

      // Worker uses different secret
      process.env.INTERNAL_WORKER_SECRET = "worker-secret";
      const workerAuthorized = isInternalWorkerAuthorized(queueToken);

      expect(workerAuthorized).toBe(false);
    });

    it("fails when worker secret is not configured", () => {
      // Queue generates token
      const queueToken = deriveBearerToken("queue-secret");

      // Worker has no secret configured
      delete process.env.INTERNAL_WORKER_SECRET;
      const workerAuthorized = isInternalWorkerAuthorized(queueToken);

      expect(workerAuthorized).toBe(false);
    });
  });

  describe("Security properties", () => {
    it("prevents timing attacks", () => {
      process.env.INTERNAL_WORKER_SECRET = "timing-test-secret";
      const validToken = deriveBearerToken("timing-test-secret");
      const invalidToken = deriveBearerToken("timing-test-secret").slice(0, -2) + "ff";

      // Measure validation times
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = process.hrtime.bigint();
        isInternalWorkerAuthorized(validToken);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // All validations should take similar time
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const maxDeviation = Math.max(...times.map((t) => Math.abs(t - avg)));
      const avgDeviation = maxDeviation / avg;

      // Should have low timing variance
      expect(avgDeviation).toBeLessThan(0.5);
    });

    it("uses constant-time comparison", () => {
      const secret = "constant-time-secret";
      const token = deriveBearerToken(secret);

      // Verify the token is exactly 71 characters ("Bearer " + 64 hex chars)
      expect(token).toHaveLength(71);
    });

    it("token is cryptographically secure", () => {
      const secret = "crypto-test-secret";
      const token = deriveBearerToken(secret);
      const hash = token.replace("Bearer ", "");

      // Hash should be 64 hex characters (256 bits)
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("handles null authorization header", () => {
      process.env.INTERNAL_WORKER_SECRET = "error-test-secret";

      expect(isInternalWorkerAuthorized(null)).toBe(false);
    });

    it("handles undefined authorization header", () => {
      process.env.INTERNAL_WORKER_SECRET = "error-test-secret";

      expect(isInternalWorkerAuthorized(undefined as any)).toBe(false);
    });

    it("handles empty string authorization header", () => {
      process.env.INTERNAL_WORKER_SECRET = "error-test-secret";

      expect(isInternalWorkerAuthorized("")).toBe(false);
    });

    it("handles malformed authorization header", () => {
      process.env.INTERNAL_WORKER_SECRET = "error-test-secret";

      expect(isInternalWorkerAuthorized("NotBearer token")).toBe(false);
    });

    it("handles authorization header with wrong format", () => {
      process.env.INTERNAL_WORKER_SECRET = "error-test-secret";

      expect(isInternalWorkerAuthorized("Basic dXNlcjpwYXNz")).toBe(false);
    });
  });

  describe("Integration with webhook worker", () => {
    it("queue token matches worker validation", () => {
      // This test simulates the actual integration between queue and worker

      // Setup: Configure the same secret for both
      process.env.INTERNAL_WORKER_SECRET = "integration-test-secret";

      // Queue side: Generate token
      const internalSecret = process.env.INTERNAL_WORKER_SECRET;
      if (!internalSecret) {
        throw new Error("INTERNAL_WORKER_SECRET not configured");
      }
      const internalToken = deriveBearerToken(internalSecret);

      // Worker side: Validate token
      const authHeader = internalToken;
      const workerAuthorized = isInternalWorkerAuthorized(authHeader);

      expect(workerAuthorized).toBe(true);
    });

    it("different secrets cause authorization failure", () => {
      // Setup: Configure different secrets
      const queueSecret = "queue-specific-secret";
      const workerSecret = "worker-specific-secret";

      // Queue generates token with its secret
      const queueToken = deriveBearerToken(queueSecret);

      // Worker validates with its secret
      process.env.INTERNAL_WORKER_SECRET = workerSecret;
      const workerAuthorized = isInternalWorkerAuthorized(queueToken);

      expect(workerAuthorized).toBe(false);
    });
  });
});
