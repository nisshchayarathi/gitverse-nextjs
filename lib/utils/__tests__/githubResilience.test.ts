import {
  GitHubRateLimitError,
  GitHubProviderError,
  GitHubAuthError,
  SENSITIVE_HEADER_NAMES,
  sanitizeGitHubHeaders,
  sanitizeGitHubError,
  redactUrlSecrets,
  parseRetryAfterSeconds,
  isRateLimited,
  isTransientError,
  computeBackoffMs,
  createGitHubRejectionHandler,
  describeGitHubError,
  isGitHubError,
  RETRYABLE_STATUS_CODES,
  NON_RETRYABLE_STATUS_CODES,
  MIN_BACKOFF_MS,
} from "../githubResilience";

const SECRET = "ghp_supersecrettoken1234567890";

interface FakeErrorInput {
  status?: number;
  headers?: Record<string, string>;
  code?: string;
  url?: string;
  configHeaders?: Record<string, unknown>;
}

/**
 * Build a plain object that axios's `isAxiosError` recognizes (it only checks
 * `isAxiosError === true`), so we avoid depending on AxiosError internals.
 */
function makeAxiosError({
  status,
  headers = {},
  code,
  url = "/repos/acme/widgets",
  configHeaders = { Authorization: `Bearer ${SECRET}` },
}: FakeErrorInput): any {
  const config = { url, headers: configHeaders };
  const err: any = new Error(`Request failed (${status ?? code ?? "network"})`);
  err.isAxiosError = true;
  if (code) err.code = code;
  err.config = config;
  err.response =
    status === undefined
      ? undefined
      : { status, headers, data: { message: "from github" }, config };
  return err;
}

describe("log sanitization (no token leakage)", () => {
  it("redacts every known sensitive header, preserving others", () => {
    const sanitized = sanitizeGitHubHeaders({
      Authorization: `Bearer ${SECRET}`,
      Cookie: "session=abc",
      "X-GitHub-Token": SECRET,
      "X-Request-Id": "req-1",
      Accept: "application/json",
    });

    expect(sanitized.Authorization).toBe("[REDACTED]");
    expect(sanitized.Cookie).toBe("[REDACTED]");
    expect(sanitized["X-GitHub-Token"]).toBe("[REDACTED]");
    expect(sanitized["X-Request-Id"]).toBe("req-1");
    expect(sanitized.Accept).toBe("application/json");
    expect(JSON.stringify(sanitized)).not.toContain(SECRET);
  });

  it("is case-insensitive and recurses into nested header objects", () => {
    const sanitized = sanitizeGitHubHeaders({
      common: { authorization: `token ${SECRET}` },
      post: { "Proxy-Authorization": SECRET },
    });
    expect(sanitized.common.authorization).toBe("[REDACTED]");
    expect(sanitized.post["Proxy-Authorization"]).toBe("[REDACTED]");
    expect(JSON.stringify(sanitized)).not.toContain(SECRET);
  });

  it("handles AxiosHeaders-like objects exposing toJSON()", () => {
    const headersLike = {
      toJSON: () => ({ Authorization: `Bearer ${SECRET}`, Accept: "x" }),
    };
    const sanitized = sanitizeGitHubHeaders(headersLike);
    expect(sanitized.Authorization).toBe("[REDACTED]");
    expect(sanitized.Accept).toBe("x");
  });

  it("redacts token-bearing query parameters from URLs", () => {
    expect(redactUrlSecrets(`/login/oauth?code=${SECRET}&state=x`)).toBe(
      "/login/oauth?code=[REDACTED]&state=x",
    );
    expect(
      redactUrlSecrets(`https://api.github.com/u?access_token=${SECRET}`),
    ).not.toContain(SECRET);
    expect(redactUrlSecrets(undefined)).toBeUndefined();
  });

  it("sanitizeGitHubError scrubs config + response so tokens never reach logs", () => {
    const err = makeAxiosError({
      status: 500,
      url: `/repos/acme/widgets?access_token=${SECRET}`,
    });
    const sanitized = sanitizeGitHubError(err);

    expect(sanitized.config.headers.Authorization).toBe("[REDACTED]");
    expect(sanitized.config.url).not.toContain(SECRET);
    // The entire serialized error must not contain the credential.
    const serialized = JSON.stringify({
      message: sanitized.message,
      config: sanitized.config,
      response: { status: sanitized.response?.status },
    });
    expect(serialized).not.toContain(SECRET);
    expect(SENSITIVE_HEADER_NAMES.has("authorization")).toBe(true);
  });

  it("sanitizeGitHubError does not mutate the original error object", () => {
    const err = makeAxiosError({
      status: 500,
      url: `/repos/acme/widgets?access_token=${SECRET}`,
    });
    const originalUrl = err.config.url;
    const originalAuth = err.config.headers.Authorization;

    sanitizeGitHubError(err);

    // The original error must remain untouched.
    expect(err.config.url).toBe(originalUrl);
    expect(err.config.headers.Authorization).toBe(originalAuth);
  });
});

describe("rate-limit detection + Retry-After extraction", () => {
  it("prefers the Retry-After header (seconds)", () => {
    expect(parseRetryAfterSeconds({ "retry-after": "30" })).toBe(30);
  });

  it("falls back to X-RateLimit-Reset (epoch seconds)", () => {
    const now = 1_000_000_000_000; // fixed clock
    const reset = Math.floor(now / 1000) + 45;
    expect(
      parseRetryAfterSeconds({ "x-ratelimit-reset": String(reset) }, now),
    ).toBe(45);
  });

  it("returns a sane default when no hints are present", () => {
    expect(parseRetryAfterSeconds({})).toBe(60);
  });

  it("detects 429 and 403+remaining:0, but not plain 403", () => {
    expect(isRateLimited(429, {})).toBe(true);
    expect(isRateLimited(403, { "x-ratelimit-remaining": "0" })).toBe(true);
    expect(isRateLimited(403, { "x-ratelimit-remaining": "57" })).toBe(false);
    expect(isRateLimited(403, {})).toBe(false);
    expect(isRateLimited(404, {})).toBe(false);
  });
});

describe("retry policy classification", () => {
  it("treats 502/503/504 and network failures as transient", () => {
    for (const status of RETRYABLE_STATUS_CODES) {
      expect(isTransientError(makeAxiosError({ status }))).toBe(true);
    }
    expect(isTransientError(makeAxiosError({ code: "ECONNRESET" }))).toBe(true);
    expect(isTransientError(makeAxiosError({ code: "ETIMEDOUT" }))).toBe(true);
  });

  it("does not treat deliberately cancelled requests as transient", () => {
    expect(isTransientError(makeAxiosError({ code: "ERR_CANCELED" }))).toBe(false);
  });

  it("does not treat client/auth errors as transient", () => {
    for (const status of NON_RETRYABLE_STATUS_CODES) {
      expect(isTransientError(makeAxiosError({ status }))).toBe(false);
    }
  });

  it("computeBackoffMs grows exponentially and respects the cap", () => {
    const max = () => 1; // full jitter -> upper bound
    expect(computeBackoffMs(1, 1000, 30000, max)).toBe(1000);
    expect(computeBackoffMs(2, 1000, 30000, max)).toBe(2000);
    expect(computeBackoffMs(3, 1000, 30000, max)).toBe(4000);
    expect(computeBackoffMs(20, 1000, 30000, max)).toBe(30000); // capped
    expect(computeBackoffMs(5, 1000, 30000, () => 0)).toBe(MIN_BACKOFF_MS); // minimum floor
  });
});

describe("rejection handler", () => {
  const fastSleep = () => Promise.resolve();

  it("surfaces 429 as GitHubRateLimitError with Retry-After and does NOT retry long waits", async () => {
    const retry = jest.fn();
    const handler = createGitHubRejectionHandler(
      retry,
      { sleep: fastSleep },
      { autoRetryRateLimitSeconds: 5 },
    );
    const err = makeAxiosError({ status: 429, headers: { "retry-after": "120" } });

    await expect(handler(err)).rejects.toMatchObject({
      name: "GitHubRateLimitError",
      retryAfterSeconds: 120,
    });
    expect(retry).not.toHaveBeenCalled();
  });

  it("auto-retries a short rate-limit wait, then succeeds", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const retry = jest.fn().mockResolvedValue("RECOVERED");
    const handler = createGitHubRejectionHandler(
      retry,
      { sleep },
      { autoRetryRateLimitSeconds: 5 },
    );
    const err = makeAxiosError({ status: 429, headers: { "retry-after": "2" } });

    await expect(handler(err)).resolves.toBe("RECOVERED");
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures with bounded backoff, then normalizes to GitHubProviderError", async () => {
    const err = makeAxiosError({ status: 503 });
    let handler: (e: any) => Promise<any>;
    // Every retry re-fails with the same (shared-config) error to exhaust attempts.
    const retry = jest.fn(async () => handler(err));
    handler = createGitHubRejectionHandler(
      retry,
      { sleep: fastSleep, random: () => 0.5 },
      { maxRetries: 3, baseDelayMs: 1 },
    );

    await expect(handler(err)).rejects.toBeInstanceOf(GitHubProviderError);
    expect(retry).toHaveBeenCalledTimes(3);
  });

  it("retries transient failures and returns success when a retry recovers", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const retry = jest.fn().mockResolvedValue("OK");
    const handler = createGitHubRejectionHandler(
      retry,
      { sleep, random: () => 0.5 },
      { maxRetries: 3, baseDelayMs: 1000 },
    );

    await expect(handler(makeAxiosError({ status: 502 }))).resolves.toBe("OK");
    expect(retry).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each(NON_RETRYABLE_STATUS_CODES)(
    "never retries non-retryable status %i",
    async (status) => {
      const retry = jest.fn();
      const handler = createGitHubRejectionHandler(retry, { sleep: fastSleep });

      await expect(handler(makeAxiosError({ status }))).rejects.toBeDefined();
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it("does not leak credentials when rethrowing a non-retryable error", async () => {
    const retry = jest.fn();
    const handler = createGitHubRejectionHandler(retry, { sleep: fastSleep });
    const err = makeAxiosError({ status: 404 });

    await expect(handler(err)).rejects.toMatchObject({
      config: { headers: { Authorization: "[REDACTED]" } },
    });
  });

  it("rethrows non-axios errors untouched (sanitized passthrough)", async () => {
    const retry = jest.fn();
    const handler = createGitHubRejectionHandler(retry, { sleep: fastSleep });
    const boom = new Error("boom");

    await expect(handler(boom)).rejects.toBe(boom);
    expect(retry).not.toHaveBeenCalled();
  });
});

describe("describeGitHubError (user-facing messages)", () => {
  it("maps rate-limit errors with retryAfter", () => {
    const d = describeGitHubError(new GitHubRateLimitError(42));
    expect(d).toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfter: 42 });
    expect(d.message).toMatch(/rate limit/i);
  });

  it("maps auth errors", () => {
    expect(describeGitHubError(new GitHubAuthError(401))).toMatchObject({
      status: 401,
      code: "AUTH_FAILED",
    });
    expect(
      describeGitHubError(makeAxiosError({ status: 403 })),
    ).toMatchObject({ code: "AUTH_FAILED" });
  });

  it("maps provider outages distinctly from auth/rate-limit", () => {
    expect(describeGitHubError(new GitHubProviderError(503))).toMatchObject({
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(
      describeGitHubError(makeAxiosError({ status: 500 })),
    ).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("maps not-found and generic client errors", () => {
    expect(describeGitHubError(makeAxiosError({ status: 404 }))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(describeGitHubError(makeAxiosError({ status: 422 }))).toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("never echoes provider internals in the message", () => {
    const d = describeGitHubError(
      makeAxiosError({ status: 500, url: `/x?access_token=${SECRET}` }),
    );
    expect(JSON.stringify(d)).not.toContain(SECRET);
    expect(JSON.stringify(d)).not.toContain("from github");
  });

  it("isGitHubError recognizes typed and axios errors only", () => {
    expect(isGitHubError(new GitHubRateLimitError(1))).toBe(true);
    expect(isGitHubError(makeAxiosError({ status: 500 }))).toBe(true);
    expect(isGitHubError(new Error("plain"))).toBe(false);
  });
});
