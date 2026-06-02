import {
  isRetryableError,
  computeBackoffMs,
  nextRetryDate,
  classifyRetry,
  DEFAULT_RETRY_CONFIG,
} from "../retry";

describe("retry utilities", () => {
  describe("isRetryableError", () => {
    it("returns true for timeout errors", () => {
      expect(isRetryableError(new Error("Request timeout"))).toBe(true);
      expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isRetryableError(new Error("connect timeout"))).toBe(true);
    });

    it("returns true for network errors", () => {
      expect(isRetryableError(new Error("Network error"))).toBe(true);
      expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isRetryableError(new Error("socket hang up"))).toBe(true);
    });

    it("returns true for rate limit errors", () => {
      expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true);
    });

    it("returns true for fetch failures", () => {
      expect(isRetryableError(new Error("fetch failed"))).toBe(true);
      expect(isRetryableError(new Error("network request failed"))).toBe(true);
    });

    it("returns true for temporarily unavailable errors", () => {
      expect(isRetryableError(new Error("Service temporarily unavailable"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    });

    it("returns true for 5xx server errors in message", () => {
      expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
      expect(isRetryableError(new Error("504 Gateway Timeout"))).toBe(true);
    });

    it("returns true for retryable HTTP status codes", () => {
      expect(isRetryableError({ status: 408 })).toBe(true);
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
    });

    it("returns true for Axios-style errors with status", () => {
      expect(isRetryableError({ response: { status: 429 } })).toBe(true);
      expect(isRetryableError({ response: { status: 503 } })).toBe(true);
    });

    it("returns false for non-retryable errors", () => {
      expect(isRetryableError(new Error("invalid API key"))).toBe(false);
      expect(isRetryableError(new Error("permission denied"))).toBe(false);
      expect(isRetryableError(new Error("not found"))).toBe(false);
      expect(isRetryableError(new Error("validation error"))).toBe(false);
    });

    it("returns false for non-retryable status codes", () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 403 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isRetryableError("")).toBe(false);
    });

    it("handles string errors", () => {
      expect(isRetryableError("timeout occurred")).toBe(true);
      expect(isRetryableError("some random error")).toBe(false);
    });

    it("handles errors with nested cause", () => {
      const error = new Error("outer");
      (error as any).cause = new Error("timeout in cause");
      expect(isRetryableError(error)).toBe(true);
    });

    it("handles errors with error property", () => {
      expect(isRetryableError({ error: "network failure" })).toBe(true);
      expect(isRetryableError({ error: "permanent failure" })).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isRetryableError(new Error("TIMEOUT"))).toBe(true);
      expect(isRetryableError(new Error("Timeout"))).toBe(true);
      expect(isRetryableError(new Error("Network Error"))).toBe(true);
    });
  });

  describe("computeBackoffMs", () => {
    it("computes exponential backoff starting from base delay", () => {
      expect(computeBackoffMs(0)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
      expect(computeBackoffMs(1)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs * 2);
      expect(computeBackoffMs(2)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs * 4);
    });

    it("caps at max delay", () => {
      const result = computeBackoffMs(100);
      expect(result).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs);
    });

    it("handles negative attempt numbers", () => {
      expect(computeBackoffMs(-1)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
      expect(computeBackoffMs(-5)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
    });

    it("accepts custom config", () => {
      const custom = { baseDelayMs: 1000, maxDelayMs: 10000 };
      expect(computeBackoffMs(0, custom)).toBe(1000);
      expect(computeBackoffMs(1, custom)).toBe(2000);
      expect(computeBackoffMs(2, custom)).toBe(4000);
    });

    it("caps with custom config", () => {
      const custom = { baseDelayMs: 1000, maxDelayMs: 5000 };
      expect(computeBackoffMs(10, custom)).toBe(5000);
    });
  });

  describe("nextRetryDate", () => {
    it("returns a Date in the future", () => {
      const before = Date.now();
      const result = nextRetryDate(0);
      const after = Date.now();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before + DEFAULT_RETRY_CONFIG.baseDelayMs);
      expect(result.getTime()).toBeLessThanOrEqual(after + DEFAULT_RETRY_CONFIG.baseDelayMs + 100);
    });

    it("uses custom config", () => {
      const custom = { baseDelayMs: 5000 };
      const before = Date.now();
      const result = nextRetryDate(0, custom);
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before + 5000);
      expect(result.getTime()).toBeLessThanOrEqual(after + 5000 + 100);
    });
  });

  describe("classifyRetry", () => {
    it("returns shouldRetry true for retryable error within retry limit", () => {
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("ETIMEDOUT"),
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(result.nextRetryAt).toBeInstanceOf(Date);
      expect(result.retryDelayMs).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
    });

    it("returns shouldRetry false when max retries exceeded", () => {
      const result = classifyRetry({
        currentRetryCount: 3,
        maxRetries: 3,
        error: new Error("ETIMEDOUT"),
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.retryCount).toBe(4);
      expect(result.nextRetryAt).toBeNull();
    });

    it("returns shouldRetry false for non-retryable error", () => {
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 3,
        error: new Error("invalid API key"),
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.retryCount).toBe(1);
      expect(result.nextRetryAt).toBeNull();
    });

    it("always increments retryCount", () => {
      const result = classifyRetry({
        currentRetryCount: 5,
        maxRetries: 3,
        error: new Error("timeout"),
      });

      expect(result.retryCount).toBe(6);
    });

    it("uses custom config", () => {
      const custom = { baseDelayMs: 1000, maxRetries: 5 };
      const result = classifyRetry({
        currentRetryCount: 0,
        maxRetries: 5,
        error: new Error("timeout"),
        config: custom,
      });

      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelayMs).toBe(1000);
    });

    it("handles various retryable error types", () => {
      const retryableErrors = [
        new Error("timeout"),
        new Error("network error"),
        new Error("rate limit exceeded"),
        new Error("fetch failed"),
        new Error("temporarily unavailable"),
        { status: 429 },
        { response: { status: 503 } },
      ];

      for (const error of retryableErrors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(true);
      }
    });

    it("handles non-retryable errors", () => {
      const nonRetryableErrors = [
        new Error("invalid input"),
        new Error("permission denied"),
        new Error("not found"),
        { status: 400 },
        { status: 401 },
      ];

      for (const error of nonRetryableErrors) {
        const result = classifyRetry({
          currentRetryCount: 0,
          maxRetries: 3,
          error,
        });
        expect(result.shouldRetry).toBe(false);
      }
    });
  });
});
