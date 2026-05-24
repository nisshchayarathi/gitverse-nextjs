/**
 * Centralized error handler and sanitizer for user-facing displays.
 * Prevents raw exceptions (like Prisma stack traces, API keys, internal routes) from showing up in the UI.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  // Extract message from typical error structures
  let rawMessage = "";
  if (typeof error === "string") {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "object") {
    rawMessage = error.message || error.error || error.details || JSON.stringify(error);
  }

  const message = rawMessage.toLowerCase();

  // 1. Rate limits and quota limits
  if (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("limit exceeded")
  ) {
    return "AI service limit reached. We are experiencing high demand, or your rate limit has been exceeded. Please wait a moment and try again.";
  }

  // 2. Authentication & Authorization
  if (
    message.includes("api key") ||
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("token") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("login required")
  ) {
    return "Authentication issue. Please ensure you are logged in and have access to this feature.";
  }

  // 3. Network and connection issues
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch") ||
    message.includes("connection") ||
    message.includes("offline") ||
    message.includes("econnrefused") ||
    message.includes("dns")
  ) {
    return "Network connection issue. Please verify your internet connection and check if the server is reachable.";
  }

  // 4. Request timeouts
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("abort") ||
    message.includes("deadline")
  ) {
    return "The request timed out. This may happen on larger tasks. Please try running the action again.";
  }

  // 5. JSON parsing and payload malformation
  if (
    message.includes("json") ||
    message.includes("syntaxerror") ||
    message.includes("malformed") ||
    message.includes("invalid response") ||
    message.includes("unexpected token")
  ) {
    return "Received an invalid or malformed response from the service. Please try again.";
  }

  // 6. Resource not found
  if (
    message.includes("not found") ||
    message.includes("404") ||
    message.includes("cannot find")
  ) {
    return "The requested analysis or resource could not be found. It may have been deleted or moved.";
  }

  // 7. Prisma, Database, or internal details (sanitize aggressively)
  if (
    message.includes("prisma") ||
    message.includes("database") ||
    message.includes("postgres") ||
    message.includes("sql") ||
    message.includes("query") ||
    message.includes("unique constraint") ||
    message.includes("foreign key") ||
    message.includes("relation") ||
    message.includes("column") ||
    message.includes("table") ||
    message.includes("500") ||
    message.includes("internal server error")
  ) {
    return "A server-side database issue occurred. Our engineers have been notified. Please try again shortly.";
  }

  // 8. Custom messages or fallback
  // If the error message seems like a friendly sentence, we can return it.
  // Otherwise, fallback to a general message.
  if (rawMessage.length > 0 && rawMessage.length < 80 && !/[{}[\]\\]/.test(rawMessage)) {
    return rawMessage;
  }

  return "Failed to complete the AI analysis. Please check your request parameters or try again later.";
}
