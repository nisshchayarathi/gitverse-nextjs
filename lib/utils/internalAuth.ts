import crypto from "crypto";

export function deriveBearerToken(secret: string): string {
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return `Bearer ${hash}`;
}

export function validateAuthorizationHeader(
  authHeader: string | null,
  secret: string | undefined
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

export function isInternalWorkerAuthorized(
  authHeader: string | null
): boolean {
  const secret = process.env.INTERNAL_WORKER_SECRET;
  return validateAuthorizationHeader(authHeader, secret);
}

export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET || process.env.ANALYSIS_RUNNER_SECRET;
  if (!secret) return false;

  const directMatch =
    authHeader != null && authHeader === `Bearer ${secret}`;
  if (directMatch) return true;

  return validateAuthorizationHeader(authHeader, secret);
}

export function isAnalysisRunnerTokenValid(
  headerSecret: string | null,
): boolean {
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
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

export function validateRequiredSecrets(): string[] {
  const missing: string[] = [];

  if (!process.env.INTERNAL_WORKER_SECRET) {
    missing.push("INTERNAL_WORKER_SECRET");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.ANALYSIS_RUNNER_SECRET) {
      missing.push("ANALYSIS_RUNNER_SECRET");
    }
  }

  return missing;
}

export function validateRequiredAnalysisSecrets(): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const runnerSecret = process.env.ANALYSIS_RUNNER_SECRET;

  if (!runnerSecret) {
    if (process.env.NODE_ENV === "production") {
      errors.push(
        "ANALYSIS_RUNNER_SECRET is required in production. " +
        "Set it to a random value generated with: openssl rand -hex 32"
      );
    } else {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET is not set. " +
        "The /api/internal/run-analysis endpoint will reject all requests."
      );
    }
  } else {
    if (runnerSecret.length < 16) {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET is shorter than 16 characters. " +
        "Use a longer secret for better security."
      );
    }

    if (
      runnerSecret === "your_analysis_runner_secret_here" ||
      runnerSecret === "changeme" ||
      runnerSecret === "secret"
    ) {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET is set to a placeholder value. " +
        "Generate a strong random value with: openssl rand -hex 32"
      );
    }

    const workerSecret = process.env.INTERNAL_WORKER_SECRET;
    if (workerSecret && runnerSecret === workerSecret) {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET should differ from INTERNAL_WORKER_SECRET. " +
        "Using the same secret for multiple purposes weakens security."
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && runnerSecret === cronSecret) {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET should differ from CRON_SECRET. " +
        "Each internal service should use its own secret."
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && runnerSecret === jwtSecret) {
      warnings.push(
        "ANALYSIS_RUNNER_SECRET should differ from JWT_SECRET. " +
        "Using the same secret for authentication and internal services weakens security."
      );
    }
  }

  return { errors, warnings };
}

export function validateSecretIsolation(): string[] {
  const warnings: string[] = [];

  const workerSecret = process.env.INTERNAL_WORKER_SECRET;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const jwtSecret = process.env.JWT_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const runnerSecret = process.env.ANALYSIS_RUNNER_SECRET;

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

  if (runnerSecret && workerSecret && runnerSecret === workerSecret) {
    warnings.push(
      "ANALYSIS_RUNNER_SECRET should differ from INTERNAL_WORKER_SECRET"
    );
  }

  if (runnerSecret && cronSecret && runnerSecret === cronSecret) {
    warnings.push(
      "ANALYSIS_RUNNER_SECRET should differ from CRON_SECRET"
    );
  }

  if (runnerSecret && jwtSecret && runnerSecret === jwtSecret) {
    warnings.push(
      "ANALYSIS_RUNNER_SECRET should differ from JWT_SECRET"
    );
  }

  return warnings;
}

export function generateInternalSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

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
