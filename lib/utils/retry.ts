/**
 * Shared retry utilities for webhook workers and analysis jobs.
 *
 * Extracted from inline implementations in:
 * - app/api/internal/worker/webhook/route.ts
 * - lib/services/analysisJobService.ts
 * - lib/services/webhookRecoveryService.ts
 *
 * Centralizes retryable error classification and exponential backoff
 * to ensure consistent behavior across all retry-capable subsystems.
 */

/**
 * Error codes that indicate transient / retryable failures.
 * Ordered by frequency of occurrence in production logs.
 */
const RETRYABLE_MESSAGE_PATTERNS: readonly string[] = [
  "timeout",
  "network",
  "rate limit",
  "fetch failed",
  "temporarily unavailable",
  "econnreset",
  "etimedout",
  "econnrefused",
  "socket hang up",
  "request timeout",
  "500",
  "502",
  "503",
  "504",
  "429",
];

/**
 * HTTP status codes that are considered retryable.
 */
const RETRYABLE_STATUS_CODES: readonly number[] = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error (may be transient)
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 10_000,
  maxDelayMs: 5 * 60_000, // 5 minutes
  backoffMultiplier: 2,
} as const;

/**
 * Determines whether an error is retryable based on its message content
 * or HTTP status code.
 *
 * @param error - The error to classify. Can be an Error object, string, or
 *   object with a `message` or `status` property.
 * @returns `true` if the error appears to be transient and worth retrying.
 *
 * @example
 * ```ts
 * isRetryableError(new Error("ETIMEDOUT"))          // true
 * isRetryableError(new Error("invalid API key"))     // false
 * isRetryableError({ status: 429 })                  // true
 * isRetryableError({ message: "rate limit exceeded", status: 429 }) // true
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  // --- status-code check (Axios-style errors) ---
  if (error && typeof error === "object") {
    const status = (error as any).status ?? (error as any).response?.status;
    if (typeof status === "number" && RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
  }

  // --- message-pattern check (checks ALL messages in the error chain) ---
  const messages = extractAllErrorMessages(error);

  for (const message of messages) {
    const lower = message.toLowerCase();
    if (
      RETRYABLE_MESSAGE_PATTERNS.some((pattern) => lower.includes(pattern))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Computes an exponential backoff delay in milliseconds.
 *
 * Formula: `min(maxDelay, baseDelay * multiplier^attempt)`
 *
 * @param attempt - Zero-indexed attempt number (0 = first retry).
 * @param config - Optional override for backoff parameters.
 * @returns Delay in milliseconds.
 *
 * @example
 * ```ts
 * computeBackoffMs(0) // 10000  (10 s)
 * computeBackoffMs(1) // 20000  (20 s)
 * computeBackoffMs(2) // 40000  (40 s)
 * computeBackoffMs(9) // 300000 (5 min – capped)
 * ```
 */
export function computeBackoffMs(
  attempt: number,
  config?: Partial<typeof DEFAULT_RETRY_CONFIG>,
): number {
  const {
    baseDelayMs,
    maxDelayMs,
    backoffMultiplier,
  } = { ...DEFAULT_RETRY_CONFIG, ...config };

  return Math.min(
    maxDelayMs,
    baseDelayMs * Math.pow(backoffMultiplier, Math.max(0, attempt)),
  );
}

/**
 * Returns a `Date` representing "now + backoff delay" for use in
 * `nextRetryAt` columns.
 */
export function nextRetryDate(
  attempt: number,
  config?: Partial<typeof DEFAULT_RETRY_CONFIG>,
): Date {
  return new Date(Date.now() + computeBackoffMs(attempt, config));
}

/**
 * Core retry decision helper.
 *
 * Encapsulates the full logic that was previously duplicated across the
 * webhook worker error handler, `webhookRecoveryService`, and
 * `analysisJobService.markFailed`.
 *
 * @param params.currentRetryCount - How many times the operation has already
 *   been retried.
 * @param params.maxRetries - Maximum number of retries allowed.
 * @param params.error - The error that caused the failure.
 * @param params.config - Optional backoff configuration overrides.
 * @returns An object describing whether to retry and the computed delay.
 *
 * @example
 * ```ts
 * const decision = classifyRetry({
 *   currentRetryCount: 1,
 *   maxRetries: 3,
 *   error: new Error("ETIMEDOUT"),
 * });
 * // { shouldRetry: true, retryCount: 2, nextRetryAt: Date, retryDelayMs: 20000 }
 * ```
 */
export function classifyRetry(params: {
  currentRetryCount: number;
  maxRetries: number;
  error: unknown;
  config?: Partial<typeof DEFAULT_RETRY_CONFIG>;
}): {
  shouldRetry: boolean;
  retryCount: number;
  nextRetryAt: Date | null;
  retryDelayMs: number;
} {
  const { currentRetryCount, maxRetries, error, config } = params;
  const retryable = isRetryableError(error);
  const shouldRetry = retryable && currentRetryCount < maxRetries;
  const retryDelayMs = computeBackoffMs(currentRetryCount, config);

  return {
    shouldRetry,
    retryCount: currentRetryCount + 1,
    nextRetryAt: shouldRetry ? new Date(Date.now() + retryDelayMs) : null,
    retryDelayMs,
  };
}

// ---- internal helpers ----

/**
 * Extracts all error messages from the error chain, including nested causes.
 * Returns an array of messages for comprehensive pattern matching.
 */
function extractAllErrorMessages(error: unknown): string[] {
  const messages: string[] = [];

  function collect(obj: unknown, depth: number = 0): void {
    if (depth > 5) return; // prevent infinite recursion
    if (obj == null) return;

    if (typeof obj === "string") {
      messages.push(obj);
      return;
    }

    if (obj instanceof Error) {
      if (obj.message) messages.push(obj.message);
      if (obj.cause) collect(obj.cause, depth + 1);
      return;
    }

    if (typeof obj === "object") {
      const e = obj as any;
      if (typeof e.message === "string") messages.push(e.message);
      if (typeof e.error === "string") messages.push(e.error);
      if (typeof e.cause === "string") messages.push(e.cause);
      if (e.cause instanceof Error || (e.cause && typeof e.cause === "object")) {
        collect(e.cause, depth + 1);
      }
      // Also check for nested response objects (Axios-style)
      if (e.response && typeof e.response === "object") {
        if (typeof e.response.data === "string") messages.push(e.response.data);
        if (e.response.data && typeof e.response.data === "object") {
          if (typeof e.response.data.message === "string") {
            messages.push(e.response.data.message);
          }
        }
      }
    }
  }

  collect(error);
  return messages;
}
