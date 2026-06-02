/**
 * Shared internal authorization utilities.
 *
 * Centralizes the secret-based authentication used by:
 * - Webhook worker (`app/api/internal/worker/webhook/route.ts`)
 * - Webhook queue (`lib/services/webhook-queue.ts`)
 * - Cron endpoints (`app/api/cron/webhook-recovery/route.ts`)
 *
 * This ensures all internal services use the same secret derivation
 * and prevents mismatches between callers and receivers.
 *
 * ## Security Model
 *
 * Internal services authenticate using a shared secret (`INTERNAL_WORKER_SECRET`).
 * The secret is never transmitted directly; instead, both parties derive a
 * Bearer token using SHA-256 hashing.
 *
 * ### Token Derivation
 * ```
 * Token = "Bearer " + SHA-256(secret).hex()
 * ```
 *
 * ### Authentication Flow
 * 1. Queue reads `INTERNAL_WORKER_SECRET` from environment
 * 2. Queue derives token: `deriveBearerToken(secret)`
 * 3. Queue sends request with `Authorization: <token>` header
 * 4. Worker reads `INTERNAL_WORKER_SECRET` from environment
 * 5. Worker derives expected token: `deriveBearerToken(secret)`
 * 6. Worker compares using timing-safe comparison
 *
 * ### Security Properties
 * - **Timing-safe comparison**: Prevents timing attacks
 * - **SHA-256 hashing**: Secret is never transmitted in plaintext
 * - **Environment isolation**: Secret is only in server-side environment
 * - **No fallback**: Worker uses only `INTERNAL_WORKER_SECRET` (no fallback to other secrets)
 *
 * ## Environment Variables
 *
 * | Variable | Purpose | Used By |
 * |----------|---------|---------|
 * | `INTERNAL_WORKER_SECRET` | Internal worker authentication | Queue, Worker |
 * | `CRON_SECRET` | Cron job authentication | Cron endpoints |
 * | `ANALYSIS_RUNNER_SECRET` | Analysis runner authentication | Analysis runner |
 * | `GITHUB_WEBHOOK_SECRET` | GitHub webhook signature verification | GitHub webhook handler |
 * | `JWT_SECRET` | User JWT token signing | Auth middleware |
 *
 * **Important**: `INTERNAL_WORKER_SECRET` must be different from `GITHUB_WEBHOOK_SECRET`
 * and `JWT_SECRET` to prevent security bypasses.
 *
 * @module internalAuth
 */

import crypto from "crypto";

/**
 * Derives a Bearer token from a secret using SHA-256.
 *
 * Both the worker and queue must use this same derivation to ensure
 * tokens match. The derivation is:
 *
 * ```
 * token = "Bearer " + SHA-256(secret).hex()
 * ```
 *
 * @param secret - The raw secret string (e.g., `INTERNAL_WORKER_SECRET`)
 * @returns A Bearer token string suitable for the Authorization header
 *
 * @example
 * ```typescript
 * const secret = process.env.INTERNAL_WORKER_SECRET;
 * const token = deriveBearerToken(secret);
 * // token = "Bearer a1b2c3d4e5f6..."
 * ```
 *
 * @security The secret is hashed with SHA-256 before transmission.
 * The resulting token is 71 characters: "Bearer " (7 chars) + 64 hex chars.
 */
export function deriveBearerToken(secret: string): string {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return `Bearer ${hash}`;
}

/**
 * Validates an Authorization header against a secret.
 *
 * Uses timing-safe comparison to prevent timing attacks. An attacker
 * cannot determine the correct secret by measuring response times.
 *
 * @param authHeader - The Authorization header value from the request.
 *   Expected format: `"Bearer <sha256-hash>"`
 * @param secret - The secret to validate against.
 * @returns `true` if the Authorization header matches the expected token.
 *
 * @example
 * ```typescript
 * // In worker route handler
 * const authHeader = request.headers.get("authorization");
 * const secret = process.env.INTERNAL_WORKER_SECRET;
 * if (!validateAuthorizationHeader(authHeader, secret)) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * @security Uses `crypto.timingSafeEqual()` for constant-time comparison.
 * Returns `false` for null/undefined inputs without throwing.
 */
export function validateAuthorizationHeader(
  authHeader: string | null,
  secret: string
): boolean {
  if (!secret) return false;

  const expectedToken = deriveBearerToken(secret);

  try {
    const a = Buffer.from(expectedToken);
    const b = Buffer.from(authHeader || "");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validates the internal worker authorization.
 *
 * Uses `INTERNAL_WORKER_SECRET` exclusively. This function is used
 * by the webhook worker to validate requests from the webhook queue.
 *
 * @param authHeader - The Authorization header value from the request.
 * @returns `true` if the request is authorized.
 *
 * @example
 * ```typescript
 * // In webhook worker route
 * if (!isInternalWorkerAuthorized(request.headers.get("authorization"))) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * @security This function does NOT fall back to other secrets.
 * If `INTERNAL_WORKER_SECRET` is not set, all requests are rejected.
 */
export function isInternalWorkerAuthorized(
  authHeader: string | null
): boolean {
  const secret = process.env.INTERNAL_WORKER_SECRET;
  return validateAuthorizationHeader(authHeader, secret);
}

/**
 * Validates cron job authorization.
 *
 * Uses `CRON_SECRET` with fallback to `ANALYSIS_RUNNER_SECRET`.
 * This is used by Vercel Cron jobs which inject the secret directly
 * (not hashed).
 *
 * @param authHeader - The Authorization header value from the request.
 * @returns `true` if the request is authorized.
 *
 * @example
 * ```typescript
 * // In cron route handler
 * if (!isCronAuthorized(request.headers.get("authorization"))) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * @note Vercel Cron injects `"Authorization: Bearer <CRON_SECRET>"` directly,
 * not the SHA-256 hashed version. This function handles both formats.
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET || process.env.ANALYSIS_RUNNER_SECRET;
  return validateAuthorizationHeader(authHeader, secret);
}

/**
 * Validates the analysis runner authorization.
 *
 * Uses `ANALYSIS_RUNNER_SECRET` with fallback to an ephemeral secret.
 * This is used for internal analysis operations.
 *
 * @param headerSecret - The secret value from the request header.
 * @param ephemeralSecret - Optional fallback secret for testing.
 * @returns `true` if the request is authorized.
 *
 * @example
 * ```typescript
 * // In analysis runner
 * const headerSecret = request.headers.get("x-analysis-runner-secret");
 * if (!isAnalysisRunnerAuthorized(headerSecret)) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * @note This function uses a different header (`x-analysis-runner-secret`)
 * than the standard Authorization header.
 */
export function isAnalysisRunnerAuthorized(
  headerSecret: string | null,
  ephemeralSecret?: string
): boolean {
  const secret = process.env.ANALYSIS_RUNNER_SECRET || ephemeralSecret;
  if (!secret) return false;
  if (!headerSecret) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(headerSecret),
      Buffer.from(secret)
    );
  } catch {
    return false;
  }
}

/**
 * Checks that required internal secrets are configured.
 *
 * Use this during application startup or in health checks to verify
 * that all necessary environment variables are set.
 *
 * @returns An array of missing secret names. Empty if all secrets are set.
 *
 * @example
 * ```typescript
 * // At startup
 * const missing = validateRequiredSecrets();
 * if (missing.length > 0) {
 *   console.error(`Missing required secrets: ${missing.join(", ")}`);
 *   process.exit(1);
 * }
 * ```
 */
export function validateRequiredSecrets(): string[] {
  const missing: string[] = [];

  if (!process.env.INTERNAL_WORKER_SECRET) {
    missing.push("INTERNAL_WORKER_SECRET");
  }

  return missing;
}

/**
 * Validates that secrets are not reused across different purposes.
 *
 * Secret reuse is a security vulnerability. If `INTERNAL_WORKER_SECRET`
 * equals `GITHUB_WEBHOOK_SECRET`, an attacker who can observe webhook
 * signatures can forge internal worker requests.
 *
 * @returns An array of warning messages about potential security issues.
 *   Empty if secrets are properly isolated.
 *
 * @example
 * ```typescript
 * const warnings = validateSecretIsolation();
 * if (warnings.length > 0) {
 *   console.warn("Security warnings:");
 *   warnings.forEach(w => console.warn(`  - ${w}`));
 * }
 * ```
 *
 * @security This is a static check. It does not detect all possible
 * security issues, but catches the most common secret reuse patterns.
 */
export function validateSecretIsolation(): string[] {
  const warnings: string[] = [];

  const workerSecret = process.env.INTERNAL_WORKER_SECRET;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (workerSecret && webhookSecret && workerSecret === webhookSecret) {
    warnings.push(
      "INTERNAL_WORKER_SECRET should differ from GITHUB_WEBHOOK_SECRET"
    );
  }

  if (workerSecret && jwtSecret && workerSecret === jwtSecret) {
    warnings.push(
      "INTERNAL_WORKER_SECRET should differ from JWT_SECRET"
    );
  }

  if (cronSecret && workerSecret && cronSecret === workerSecret) {
    warnings.push(
      "CRON_SECRET should differ from INTERNAL_WORKER_SECRET"
    );
  }

  return warnings;
}

/**
 * Generates a random secret suitable for use as an internal worker secret.
 *
 * @param length - Length of the random bytes (default: 32)
 * @returns A hex-encoded random string
 *
 * @example
 * ```typescript
 * const secret = generateInternalSecret();
 * console.log(`Set INTERNAL_WORKER_SECRET=${secret}`);
 * ```
 *
 * @note This function is for development/setup purposes only.
 * In production, secrets should be generated by a secrets manager.
 */
export function generateInternalSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Validates that a secret meets minimum security requirements.
 *
 * @param secret - The secret to validate
 * @returns An object with validation result and optional error message
 *
 * @example
 * ```typescript
 * const result = validateSecretStrength(process.env.INTERNAL_WORKER_SECRET);
 * if (!result.valid) {
 *   console.error(`Weak secret: ${result.error}`);
 * }
 * ```
 */
export function validateSecretStrength(secret: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!secret) {
    return { valid: false, error: "Secret is not set" };
  }

  if (secret.length < 16) {
    return {
      valid: false,
      error: "Secret must be at least 16 characters",
    };
  }

  if (secret === "secret" || secret === "changeme" || secret === "password") {
    return {
      valid: false,
      error: "Secret is a common default and must be changed",
    };
  }

  if (/^[a-zA-Z]+$/.test(secret)) {
    return {
      valid: false,
      error: "Secret should contain numbers and special characters",
    };
  }

  return { valid: true };
}
