/**
 * Validates a GitHub repository identifier format (owner/repo).
 * Allowed format: alphanumeric, hyphens, underscores, and periods.
 * Max length: 150 characters to prevent DoS.
 * Prevents path traversal patterns like ../ or excessive slashes.
 */
export function isValidRepositoryIdentifier(
  identifier: string | null | undefined,
): boolean {
  if (!identifier || typeof identifier !== "string") return false;

  if (identifier.length > 150 || identifier.length < 3) return false;

  // Strict regex: Owner/Repo (1 slash exactly)
  // Each segment: 1 to 100 characters of [A-Za-z0-9_.-]
  const regex = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
  if (!regex.test(identifier)) return false;

  // Additional check to prevent encoded traversals or direct traversal matches
  if (
    identifier.includes("..") ||
    identifier.startsWith("/") ||
    identifier.endsWith("/")
  ) {
    return false;
  }

  return true;
}
