export const MAX_PROMPT_LENGTH = 4000;

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous\s+|prior\s+)?instructions/i,
  /forget\s+(?:all\s+)?(?:previous\s+|prior\s+)?instructions/i,
  /bypass\s+(?:safety\s+|security\s+)?(?:restrictions|filters)/i,
  /you\s+are\s+now\s+a/i,
  /acting\s+as\s+a/i,
  /(?:reveal|show|output|print|display)\s+(?:your\s+)?system\s+(?:prompt|instructions|context)/i,
  /do\s+not\s+follow\s+(?:any\s+)?instructions/i,
];

/**
 * Normalizes Unicode and removes non-printable ASCII/Unicode control/invisible characters.
 */
function stripControlCharacters(text: string): string {
  // Normalize Unicode representation (NFKC Compatibility Composition)
  const normalized = text.normalize("NFKC");
  
  // Removes standard non-printable ASCII control characters (except \t, \n, \r) 
  // and Unicode invisible/formatting characters
  return normalized.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\u2060\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
    ""
  );
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedPrompt?: string;
}

/**
 * Validates and sanitizes a free-form prompt.
 *
 * - Ensures the prompt is a string.
 * - Trims and checks if the prompt is empty.
 * - Limits length to MAX_PROMPT_LENGTH.
 * - Normalizes Unicode and removes invisible characters.
 * - Detects common prompt injection patterns.
 */
export function validateAndSanitizePrompt(prompt: unknown): ValidationResult {
  if (typeof prompt !== "string") {
    return {
      isValid: false,
      error: "Prompt must be a string",
    };
  }

  const trimmed = prompt.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Prompt cannot be empty",
    };
  }

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      isValid: false,
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_LENGTH} characters`,
    };
  }

  // Sanitize control and invisible characters first to prevent bypasses
  const cleanControl = stripControlCharacters(trimmed);

  // Treat empty-after-sanitization as a rejection (e.g. prompt containing only invisible characters)
  if (!cleanControl.trim()) {
    return {
      isValid: false,
      error: "Potential prompt injection detected",
    };
  }

  // Detect potential prompt injection on the fully sanitized and normalized string
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleanControl)) {
      return {
        isValid: false,
        error: "Potential prompt injection detected",
      };
    }
  }

  return {
    isValid: true,
    sanitizedPrompt: cleanControl,
  };
}
