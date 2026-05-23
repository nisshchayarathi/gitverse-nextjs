/*
 * Manual repro — run these curl commands against the local dev server:
 *
 * # Missing body → should return 400
 * curl -X POST http://localhost:3000/api/auth/logout \
 *   -H "Content-Type: application/json"
 *
 * # Invalid email → should return 400 with field message
 * curl -X POST http://localhost:3000/api/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"notvalid","password":"securepass123"}'
 *
 * # Short password → should return 400
 * curl -X POST http://localhost:3000/api/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"user@example.com","password":"abc"}'
 *
 * # Valid input → should return 200 or proceed normally
 * curl -X POST http://localhost:3000/api/auth/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"user@example.com","password":"securepass123"}'
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, field: "email", error: "Email is required" };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, field: "email", error: "Email cannot be empty" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, field: "email", error: "Email format is invalid" };
  }
  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, field: "password", error: "Password is required" };
  }
  if (password.length < 6) {
    return {
      valid: false,
      field: "password",
      error: "Password must be at least 6 characters",
    };
  }
  return { valid: true };
}

export function validateRequiredString(
  value: unknown,
  fieldName: string
): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, field: fieldName, error: `${fieldName} is required` };
  }
  if (typeof value !== "string") {
    return {
      valid: false,
      field: fieldName,
      error: `${fieldName} must be a string`,
    };
  }
  if (value.trim().length === 0) {
    return {
      valid: false,
      field: fieldName,
      error: `${fieldName} cannot be empty`,
    };
  }
  return { valid: true };
}

// Parse request body safely — returns null if body is missing or not valid JSON
export async function parseJsonBody(
  request: Request
): Promise<{ body: Record<string, unknown> } | { error: string }> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { error: "Content-Type must be application/json" };
    }
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      return { error: "Request body cannot be empty" };
    }
    const body = JSON.parse(text);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { error: "Request body must be a JSON object" };
    }
    return { body };
  } catch {
    return { error: "Request body contains invalid JSON" };
  }
}
