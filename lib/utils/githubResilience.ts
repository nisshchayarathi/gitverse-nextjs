import { AxiosInstance, isAxiosError } from "axios";

/**
 * Centralized resilience, observability, and security utilities for talking to
 * the GitHub (and compatible provider) REST API.
 *
 * This module is intentionally framework-agnostic and free of side effects so it
 * can be reused by any GitHub integration endpoint without duplicating logic:
 *
 *   - Rate-limit detection (HTTP 429 / secondary limits) + Retry-After extraction
 *   - Bounded exponential backoff retries for transient failures
 *   - A strict allow/deny policy so non-retryable errors fail fast
 *   - Error normalization into typed errors the API layer can map to responses
 *   - Log sanitization so provider tokens / Authorization headers never leak
 */

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/**
 * Thrown when GitHub reports a primary or secondary rate limit. The
 * `retryAfterSeconds` value is surfaced to clients so the UI can tell the user
 * exactly how long to wait.
 */
export class GitHubRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(
      `GitHub API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`,
    );
    this.name = "GitHubRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Thrown for authentication / authorization failures (401, or non-rate-limit 403). */
export class GitHubAuthError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message || "GitHub authentication failed or access was denied.");
    this.name = "GitHubAuthError";
    this.status = status;
  }
}

/**
 * Thrown when GitHub is temporarily unavailable (5xx / network failure) and the
 * request still failed after exhausting retries.
 */
export class GitHubProviderError extends Error {
  status?: number;
  constructor(status?: number, message?: string) {
    super(message || "GitHub is temporarily unavailable. Please try again shortly.");
    this.name = "GitHubProviderError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Log sanitization (never leak provider tokens)
// ---------------------------------------------------------------------------

/** Header names whose values must never be written to logs. */
export const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-github-token",
  "x-hub-signature",
  "x-hub-signature-256",
]);

const REDACTED = "[REDACTED]";

/**
 * Recursively clone a headers object/array, replacing the value of any
 * sensitive header with a redaction placeholder. Handles axios `AxiosHeaders`
 * instances (which expose `.toJSON()`).
 */
export function sanitizeGitHubHeaders(headers: any): any {
  if (headers == null) {
    return headers;
  }

  if (Array.isArray(headers)) {
    return headers.map((value) => sanitizeGitHubHeaders(value));
  }

  if (typeof headers !== "object") {
    return headers;
  }

  const source =
    typeof (headers as any).toJSON === "function"
      ? (headers as any).toJSON()
      : headers;

  if (source == null || typeof source !== "object") {
    return source;
  }

  const sanitized: Record<string, any> = Array.isArray(source) ? [] : {};

  for (const [key, value] of Object.entries(source)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      sanitized[key] = REDACTED;
    } else if (value != null && typeof value === "object") {
      sanitized[key] = sanitizeGitHubHeaders(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Strip sensitive material from an error before it is logged or re-thrown.
 * Redacts Authorization (and other credential) headers from both the request
 * config and any captured response, and removes inline `access_token` /
 * `client_secret` query parameters from the request URL.
 *
 * Returns a **shallow clone** — the original error is never mutated, which
 * preserves debug data and avoids side-effects on shared config objects that
 * axios may reuse across retries.
 */
export function sanitizeGitHubError(error: any): any {
  if (!isAxiosError(error)) return error;

  const clone: any = new Error(error.message);
  clone.name = error.name;
  clone.stack = error.stack;
  clone.isAxiosError = true;
  clone.code = error.code;

  if (error.config) {
    clone.config = {
      ...error.config,
      headers: sanitizeGitHubHeaders(error.config.headers),
      url: redactUrlSecrets(error.config.url),
    };
  }
  if (error.response) {
    clone.response = {
      ...error.response,
      request: undefined,
      config: error.response.config
        ? {
          ...error.response.config,
          headers: sanitizeGitHubHeaders(error.response.config.headers),
          url: redactUrlSecrets(error.response.config.url),
        }
        : undefined,
    };
  }

  return clone;
}

/** Redact token-bearing query parameters from a URL string. */
export function redactUrlSecrets(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(
    /([?&](?:access_token|client_secret|token|code)=)[^&#]+/gi,
    `$1${REDACTED}`,
  );
}

// ---------------------------------------------------------------------------
// Rate-limit detection
// ---------------------------------------------------------------------------

/** Default fallback wait time (seconds) when GitHub gives us no hint. */
export const DEFAULT_RETRY_AFTER_SECONDS = 60;

function headerValue(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct != null) return String(direct);
  // AxiosHeaders / case-insensitive lookups
  if (typeof headers.get === "function") {
    const got = headers.get(name);
    if (got != null) return String(got);
  }
  return undefined;
}

/**
 * Extract how long the caller should wait before retrying, in seconds, from the
 * `Retry-After` header (preferred) or the `X-RateLimit-Reset` epoch header.
 */
export function parseRetryAfterSeconds(
  headers: any,
  now: number = Date.now(),
): number {
  const retryAfter = headerValue(headers, "retry-after");
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(1, seconds);
    }
  }

  const reset = headerValue(headers, "x-ratelimit-reset");
  if (reset) {
    const resetMs = Number.parseInt(reset, 10) * 1000;
    if (Number.isFinite(resetMs)) {
      return Math.max(1, Math.ceil((resetMs - now) / 1000));
    }
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Detect a rate-limit response. GitHub signals this either with HTTP 429 or with
 * HTTP 403 plus `X-RateLimit-Remaining: 0` (the classic primary-limit case).
 */
export function isRateLimited(status: number | undefined, headers: any): boolean {
  if (status === 429) return true;
  if (status === 403) {
    return headerValue(headers, "x-ratelimit-remaining") === "0";
  }
  return false;
}

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

/** HTTP status codes that represent a transient upstream failure worth retrying. */
export const RETRYABLE_STATUS_CODES = [502, 503, 504];

/** Status codes that must never be retried (caller/auth/validation errors). */
export const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 409, 422];

/**
 * A transient failure is a 5xx GitHub response, an aborted/timed-out request, or
 * a network-level failure where no response was received. Rate limits are handled
 * separately so they can surface Retry-After.
 */
export function isTransientError(error: any): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status && RETRYABLE_STATUS_CODES.includes(status)) return true;
  // No response at all => DNS / connection reset / timeout.
  if (!error.response) {
    // Deliberately cancelled requests (AbortController) must not be retried.
    if (error.code === "ERR_CANCELED") return false;
    // Only retry recognized transient network error codes. Unknown errors
    // without a response fail fast rather than being blindly retried.
    return (
      error.code === "ECONNABORTED" ||
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND" ||
      error.code === "EAI_AGAIN"
    );
  }
  return false;
}

export interface ResilienceOptions {
  /** Maximum number of retry attempts (in addition to the first try). Default 3. */
  maxRetries?: number;
  /** Base delay for exponential backoff, in ms. Default 1000. */
  baseDelayMs?: number;
  /** Upper bound for a single backoff wait, in ms. Default 30000. */
  maxDelayMs?: number;
  /**
   * Automatically wait-and-retry rate limits only when Retry-After is at or below
   * this many seconds; otherwise fail fast with GitHubRateLimitError so the user
   * is told to come back later. Default 2.
   */
  autoRetryRateLimitSeconds?: number;
}

const DEFAULTS: Required<ResilienceOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  autoRetryRateLimitSeconds: 2,
};

/** Minimum backoff delay (ms) to prevent instant zero-delay retries. */
export const MIN_BACKOFF_MS = 100;

/**
 * Full-jitter exponential backoff: `max(floor, random(0, min(cap, base * 2^attempt)))`.
 * `attempt` is 1-based (first retry => attempt 1).
 */
export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number = DEFAULTS.baseDelayMs,
  maxDelayMs: number = DEFAULTS.maxDelayMs,
  random: () => number = Math.random,
): number {
  const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(maxDelayMs, exponential);
  return Math.max(MIN_BACKOFF_MS, Math.round(random() * capped));
}

interface HandlerDeps {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * Build an axios rejection handler that applies the resilience policy. Exposed
 * separately from {@link attachGitHubResilience} so it can be unit-tested with a
 * fake `retry`/`sleep` and synthetic axios errors.
 *
 * @param retry  Re-issues the request given its (already credentialed) config.
 */
export function createGitHubRejectionHandler(
  retry: (config: any) => Promise<any>,
  deps: HandlerDeps = {},
  options: ResilienceOptions = {},
) {
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const opts = { ...DEFAULTS, ...options };

  return async function onRejected(error: any): Promise<any> {
    if (!isAxiosError(error) || !error.config) {
      throw sanitizeGitHubError(error);
    }

    const status = error.response?.status;
    const headers = error.response?.headers;
    const config = error.config as any;
    config.__githubRetryCount = config.__githubRetryCount ?? 0;

    // 1) Rate limited: surface Retry-After, optionally auto-retry short waits.
    if (isRateLimited(status, headers)) {
      const retryAfterSeconds = parseRetryAfterSeconds(headers);
      if (
        config.__githubRetryCount < opts.maxRetries &&
        retryAfterSeconds <= opts.autoRetryRateLimitSeconds
      ) {
        config.__githubRetryCount += 1;
        await sleep(retryAfterSeconds * 1000);
        return retry(config);
      }
      throw new GitHubRateLimitError(retryAfterSeconds);
    }

    // 2) Transient upstream/network failure: bounded exponential backoff.
    if (isTransientError(error)) {
      if (config.__githubRetryCount < opts.maxRetries) {
        config.__githubRetryCount += 1;
        await sleep(
          computeBackoffMs(
            config.__githubRetryCount,
            opts.baseDelayMs,
            opts.maxDelayMs,
            random,
          ),
        );
        return retry(config);
      }
      // Retries exhausted: normalize so the API layer reports an outage.
      throw new GitHubProviderError(status, sanitizeGitHubError(error).message);
    }

    // 3) Everything else (400/401/403/404/422/...) is non-retryable.
    throw sanitizeGitHubError(error);
  };
}

/**
 * Attach the resilience policy to an axios instance. All GitHub clients should
 * be created through this so every integration endpoint inherits identical
 * retry, rate-limit, and credential-redaction behavior.
 */
export function attachGitHubResilience(
  client: AxiosInstance,
  options?: ResilienceOptions,
): AxiosInstance {
  const handler = createGitHubRejectionHandler(
    (config) => client(config),
    {},
    options,
  );
  client.interceptors.response.use((response) => response, handler);
  return client;
}

// ---------------------------------------------------------------------------
// API response mapping (consistent, actionable user-facing messages)
// ---------------------------------------------------------------------------

export interface GitHubErrorDescription {
  status: number;
  /** Stable machine-readable code for clients. */
  code:
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNKNOWN";
  /** Human-readable, non-sensitive message safe to return to the client. */
  message: string;
  /** Seconds to wait before retrying, when the error is a rate limit. */
  retryAfter?: number;
}

/**
 * True when the error originated from the GitHub layer (a typed resilience error
 * or a raw axios/network failure). Lets routes branch to {@link describeGitHubError}
 * before falling back to generic handling.
 */
export function isGitHubError(error: unknown): boolean {
  return (
    error instanceof GitHubRateLimitError ||
    error instanceof GitHubAuthError ||
    error instanceof GitHubProviderError ||
    isAxiosError(error)
  );
}

/**
 * Map any error thrown by the GitHub layer to a safe, user-facing description.
 * Reusable across endpoints so error responses stay consistent and never echo
 * provider internals or credentials.
 */
export function describeGitHubError(error: unknown): GitHubErrorDescription {
  if (error instanceof GitHubRateLimitError) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message:
        "GitHub's rate limit has been reached. Please wait a moment and try again.",
      retryAfter: error.retryAfterSeconds,
    };
  }

  if (error instanceof GitHubAuthError) {
    return {
      status: 401,
      code: "AUTH_FAILED",
      message:
        "GitHub authorization failed. Please reconnect your GitHub account and try again.",
    };
  }

  if (error instanceof GitHubProviderError) {
    return {
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      message:
        "GitHub is temporarily unavailable. We retried automatically — please try again shortly.",
    };
  }

  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return {
        status: 401,
        code: "AUTH_FAILED",
        message:
          "GitHub authorization failed. Please reconnect your GitHub account and try again.",
      };
    }
    if (status === 404) {
      return {
        status: 404,
        code: "NOT_FOUND",
        message: "The requested GitHub resource could not be found.",
      };
    }
    if (status && status >= 500) {
      return {
        status: 503,
        code: "PROVIDER_UNAVAILABLE",
        message: "GitHub is temporarily unavailable. Please try again shortly.",
      };
    }
    if (status && status >= 400) {
      return {
        status: 400,
        code: "BAD_REQUEST",
        message: "The request to GitHub was rejected. Please review your input.",
      };
    }
  }

  return {
    status: 500,
    code: "UNKNOWN",
    message: "An unexpected error occurred while contacting GitHub.",
  };
}
