/**
 * Centralized utility for lazily resolving environment variables
 * to prevent build-time crashes caused by eager evaluation.
 */

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (secret) {
    return secret;
  }

  // Allow fallback in development or test environments
  if (process.env.NODE_ENV !== 'production') {
    return 'development-jwt-secret';
  }

  // In production, throw a safe error without exposing internal names or stack traces
  throw new Error("Internal Server Error: Missing required security configuration.");
}

export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'development-nextauth-secret';
  }

  throw new Error("Internal Server Error: Missing required security configuration.");
}
