import {
  validateRequiredSecrets,
  validateRequiredAnalysisSecrets,
  validateSecretIsolation,
} from "../lib/utils/internalAuth";

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const missingSecrets = validateRequiredSecrets();
  if (missingSecrets.length > 0) {
    errors.push(
      `Missing required secrets: ${missingSecrets.join(", ")}. ` +
        `Set INTERNAL_WORKER_SECRET and ANALYSIS_RUNNER_SECRET in your environment.`
    );
  }

  const isolationWarnings = validateSecretIsolation();
  if (isolationWarnings.length > 0) {
    warnings.push(...isolationWarnings);
  }

  const analysisSecrets = validateRequiredAnalysisSecrets();
  if (analysisSecrets.errors.length > 0) {
    errors.push(...analysisSecrets.errors);
  }
  if (analysisSecrets.warnings.length > 0) {
    warnings.push(...analysisSecrets.warnings);
  }

  const workerSecret = process.env.INTERNAL_WORKER_SECRET;
  if (workerSecret && workerSecret.length < 16) {
    warnings.push(
      "INTERNAL_WORKER_SECRET is shorter than 16 characters. " +
        "Consider using a longer secret for better security."
    );
  }

  if (workerSecret && workerSecret === "secret") {
    warnings.push(
      'INTERNAL_WORKER_SECRET is set to "secret". ' +
        "This is a common default and should be changed."
    );
  }

  if (workerSecret && workerSecret === "changeme") {
    warnings.push(
      'INTERNAL_WORKER_SECRET is set to "changeme". ' +
        "This is a placeholder and should be changed."
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

if (require.main === module) {
  console.log("Validating environment configuration...\n");

  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    console.log("Warnings:");
    result.warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
    console.log();
  }

  if (result.errors.length > 0) {
    console.error("Errors:");
    result.errors.forEach((e) => console.error(`  ❌ ${e}`));
    console.log();
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    process.exit(2);
  }

  console.log("✅ All validations passed!\n");
  process.exit(0);
}
