import { classifyRetry, computeBackoffMs, isRetryableError } from "../retry";

describe("Webhook Worker Retry Logic", () => {
  describe("retry classification", () => {
    it("classifies timeout errors as retryable", () => {
      const errors = [
        new Error("Request timeout after 30000ms"),
        new Error("ETIMEDOUT"),
        new Error("Connection timeout"),
        new Error("Gateway timeout"),
      ];

      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }
    });

    it("classifies network errors as retryable", () => {
      const errors = [
        new Error("ECONNRESET"),
        new Error("ECONNREFUSED"),
        new Error("socket hang up"),
        new Error("Network error"),
        new Error("fetch failed"),
      ];

      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }
    });

    it("classifies rate limit errors as retryable", () => {
      const errors = [
        new Error("rate limit exceeded"),
        new Error("429 Too Many Requests"),
        { status: 429 },
        { response: { status: 429 } },
      ];

      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }
    });

    it("classifies 5xx errors as retryable", () => {
      // Test message-based 5xx errors
      const messageErrors = [
        new Error("500 Internal Server Error"),
        new Error("502 Bad Gateway"),
        new Error("503 Service Unavailable"),
        new Error("504 Gateway Timeout"),
      ];

      for (const error of messageErrors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }

      // Test status code-based 5xx errors
      const statusErrors = [
        { status: 500 },
        { status: 502 },
        { status: 503 },
        { status: 504 },
      ];

      for (const error of statusErrors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }
    });

    it("classifies validation errors as non-retryable", () => {
      const errors = [
        new Error("Invalid input"),
        new Error("Missing required field"),
        new Error("Validation failed"),
      ];

      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(false);
      }
    });

    it("classifies authentication errors as non-retryable", () => {
      const errors = [
        new Error("Invalid API key"),
        new Error("Unauthorized"),
        new Error("Forbidden"),
        { status: 401 },
        { status: 403 },
      ];

      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(false);
      }
    });
  });

  describe("retry count management", () => {
    it("increments retry count on each retry", () => {
      const errors = [
        new Error("timeout"),
        new Error("network error"),
        new Error("rate limit"),
      ];

      let retryCount = 0;
      for (const error of errors) {
        const result = classifyRetry({
          currentRetryCount: retryCount,
          maxRetries: 3,
          error,
        });
        expect(result.retryCount).toBe(retryCount + 1);
        retryCount = result.retryCount;
      }
    });

    it("stops retrying after max retries", () => {
      const result = classifyRetry({
        currentRetryCount: 3,
        maxRetries: 3,
        error: new Error("timeout"),
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.retryCount).toBe(4);
      expect(result.nextRetryAt).toBeNull();
    });

    it("allows retry when under max retries", () => {
      for (let i = 0; i < 3; i++) {
        const result = classifyRetry({
          currentRetryCount: i,
          maxRetries: 3,
          error: new Error("timeout"),
        });
        expect(result.shouldRetry).toBe(true);
      }
    });
  });

  describe("backoff timing", () => {
    it("uses exponential backoff", () => {
      expect(computeBackoffMs(0)).toBe(10000);   // 10s
      expect(computeBackoffMs(1)).toBe(20000);   // 20s
      expect(computeBackoffMs(2)).toBe(40000);   // 40s
      expect(computeBackoffMs(3)).toBe(80000);   // 80s
      expect(computeBackoffMs(4)).toBe(160000);  // 160s
    });

    it("caps at 5 minutes", () => {
      expect(computeBackoffMs(10)).toBe(300000); // 5 min
      expect(computeBackoffMs(100)).toBe(300000); // 5 min
    });

    it("handles negative attempt numbers", () => {
      expect(computeBackoffMs(-1)).toBe(10000); // defaults to attempt 0
      expect(computeBackoffMs(-100)).toBe(10000);
    });
  });

  describe("webhook event state transitions", () => {
    it("sets status to pending for retryable errors", () => {
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("ETIMEDOUT"),
      });

      expect(result.shouldRetry).toBe(true);
      // In the worker, this would set status: "pending"
    });

    it("sets status to failed for non-retryable errors", () => {
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("Invalid API key"),
      });

      expect(result.shouldRetry).toBe(false);
      // In the worker, this would set status: "failed"
    });

    it("sets status to failed when max retries exceeded", () => {
      const result = classifyRetry({
        currentRetryCount: 3,
        maxRetries: 3,
        error: new Error("timeout"),
      });

      expect(result.shouldRetry).toBe(false);
      // In the worker, this would set status: "failed"
    });

    it("sets nextRetryAt for retryable errors", () => {
      const before = Date.now();
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("timeout"),
      });

      expect(result.nextRetryAt).toBeInstanceOf(Date);
      expect(result.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + 10000);
    });

    it("sets nextRetryAt to null for non-retryable errors", () => {
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("invalid input"),
      });

      expect(result.nextRetryAt).toBeNull();
    });
  });

  describe("error message extraction", () => {
    it("handles Error objects", () => {
      expect(isRetryableError(new Error("timeout"))).toBe(true);
    });

    it("handles string errors", () => {
      expect(isRetryableError("timeout occurred")).toBe(true);
    });

    it("handles objects with message property", () => {
      expect(isRetryableError({ message: "timeout" })).toBe(true);
    });

    it("handles objects with error property", () => {
      expect(isRetryableError({ error: "network failure" })).toBe(true);
    });

    it("handles nested error causes", () => {
      const error = new Error("outer");
      (error as any).cause = new Error("inner timeout");
      expect(isRetryableError(error)).toBe(true);
    });

    it("handles null and undefined gracefully", () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });
});
