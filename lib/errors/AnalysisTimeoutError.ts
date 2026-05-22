/**
 * Custom error class for analysis timeout scenarios.
 * Allows typed error handling instead of relying on string matching.
 */
export class AnalysisTimeoutError extends Error {
  constructor(message: string = "Analysis timeout exceeded") {
    super(message);
    this.name = "AnalysisTimeoutError";
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AnalysisTimeoutError.prototype);
  }
}
