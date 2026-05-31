const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GEMINI_API_KEY",
  "INTERNAL_WORKER_SECRET",
  "TOKEN_ENCRYPTION_KEY",
] as const;

function shouldSkipEnvValidation() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true"
  );
}

function validateEnv() {
  if (shouldSkipEnvValidation()) {
    console.log("⚠️ Skipping environment validation in test/CI environment");

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