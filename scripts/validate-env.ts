import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

type ValidationResult = {
  key: string;
  required: boolean;
  isValid: boolean;
  message: string;
};

const envFileCandidates = [".env.local", ".env"];

function loadEnvironmentFile() {
  for (const candidate of envFileCandidates) {
    const filePath = path.resolve(process.cwd(), candidate);

    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
      return filePath;
    }
  }

  return null;
}

function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "your-secret-here" ||
    normalized === "replace-me" ||
    normalized === "change-me" ||
    normalized === "example" ||
    normalized.includes("your-") ||
    normalized.includes("placeholder")
  );
}

function isAbsoluteUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function colorize(text: string, code: number) {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function validateRequiredValue(
  key: string,
  value: string | undefined,
  validate: (trimmedValue: string) => { isValid: boolean; message: string },
): ValidationResult {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return {
      key,
      required: true,
      isValid: false,
      message: "Missing required value",
    };
  }

  const result = validate(trimmedValue);

  return {
    key,
    required: true,
    isValid: result.isValid,
    message: result.message,
  };
}

function validateOptionalValue(
  key: string,
  value: string | undefined,
  validate: (trimmedValue: string) => { isValid: boolean; message: string },
): ValidationResult | null {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  const result = validate(trimmedValue);

  return {
    key,
    required: false,
    isValid: result.isValid,
    message: result.message,
  };
}

function formatResult(result: ValidationResult): string {
  const statusIcon = result.isValid ? "✅" : "❌";
  const colorCode = result.isValid ? 32 : 31; // Green for success, Red for failure
  return colorize(`${statusIcon} ${result.key}: ${result.message}`, colorCode);
}

function runValidation() {
  const loadedPath = loadEnvironmentFile();

  if (!loadedPath) {
    console.warn(colorize("⚠️ No environment file found, relying on process.env", 33));
  } else {
    console.log(colorize(`Loaded environment from: ${loadedPath}\n`, 36));
  }

  const results: (ValidationResult | null)[] = [
    validateRequiredValue("JWT_SECRET", process.env.JWT_SECRET, (value) => {
      const isValid = Buffer.byteLength(value, "utf8") >= 32 && !isPlaceholder(value);

      return {
        isValid,
        message: isValid
          ? "Meets the 32-byte minimum"
          : "Should be at least 32 bytes/characters for adequate security",
      };
    }),
    validateRequiredValue("GEMINI_API_KEY", process.env.GEMINI_API_KEY, (value) => {
      const isValid = !isPlaceholder(value);

      return {
        isValid,
        message: isValid ? "Configured" : "Must not be a placeholder value",
      };
    }),
    validateRequiredValue("NEXTAUTH_SECRET", process.env.NEXTAUTH_SECRET, (value) => {
      const isValid = Buffer.byteLength(value, "utf8") >= 32 && !isPlaceholder(value);

      return {
        isValid,
        message: isValid
          ? "Meets the 32-byte minimum"
          : "Should be non-placeholder and at least 32 bytes/characters",
      };
    }),
    validateRequiredValue("NEXTAUTH_URL", process.env.NEXTAUTH_URL, (value) => {
      const isValid = isAbsoluteUrl(value) && !isPlaceholder(value);

      return {
        isValid,
        message: isValid ? "Valid absolute URL" : "Must be a valid absolute http(s) URL and not a placeholder",
      };
    }),
    validateOptionalValue("GITHUB_APP_ID", process.env.GITHUB_APP_ID, (value) => {
      const isValid = !isPlaceholder(value);

      return {
        isValid,
        message: isValid ? "Configured" : "Should not be a placeholder value",
      };
    }),
    validateOptionalValue(
      "GITHUB_APP_PRIVATE_KEY",
      process.env.GITHUB_APP_PRIVATE_KEY,
      (value) => {
        const isValid = !isPlaceholder(value);

        return {
          isValid,
          message: isValid ? "Configured" : "Should not be a placeholder value",
        };
      },
    ),
  ];

  const activeResults = results.filter((result): result is ValidationResult => result !== null);
  const failures = activeResults.filter((result) => !result.isValid);

  activeResults.forEach((result) => {
    console.log(formatResult(result));
  });

  if (failures.length > 0) {
    console.error(
      colorize(`\nEnvironment validation failed with ${failures.length} issue(s).`, 31),
    );
    process.exit(1);
  }

  console.log(colorize("\nEnvironment validation passed.", 32));
}

try {
  runValidation();
} catch (error) {
  console.error("An unexpected error occurred during validation:", error);
  process.exit(1);
}
