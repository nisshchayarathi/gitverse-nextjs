const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GEMINI_API_KEY",
] as const;

function validateEnv() {
  if (process.env.SKIP_ENV_VALIDATION === "true" || process.env.NODE_ENV === "test") {
    console.log("⚠️ Environment validation skipped");
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