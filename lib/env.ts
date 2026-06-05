const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "GEMINI_API_KEY",
  "INTERNAL_WORKER_SECRET",
  "TOKEN_ENCRYPTION_KEY",
] as const;

function getEnvValidationSkipReasons() {
  const reasons: string[] = [];

  if (process.env.NODE_ENV === "test") {
    reasons.push("NODE_ENV=test");
  }
  if (process.env.CI === "true") {
    reasons.push("CI=true");
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    reasons.push("GITHUB_ACTIONS=true");
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    reasons.push("NEXT_PHASE=phase-production-build");
  }

  return reasons;
}

function shouldSkipEnvValidation() {
  return getEnvValidationSkipReasons().length > 0;
}

function validateEnv() {
  const skipReasons = getEnvValidationSkipReasons();

  if (skipReasons.length > 0) {
    console.log(
      `⚠️ Skipping environment validation: ${skipReasons.join(" | ")}`
    );

    return;
  }

  const missingVars = requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar];

    return !value || value.trim() === "";
  });

  if (missingVars.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("✅ Environment variables validated successfully");
}

validateEnv();

export {};