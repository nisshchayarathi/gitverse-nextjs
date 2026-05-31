/**
 * Validates whether a given string is a strictly malformed or well-formed public GitHub repository URL.
 * Matches:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo/
 * - https://www.github.com/owner/repo.git
 */
export function isValidGithubUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  
  // Strict regex accounting for subdomains (www.), optional trailing slashes, and optional .git extensions.
  const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-._]+\/[a-zA-Z0-9-._]+(\.git)?\/?$/;
  return githubRegex.test(url.trim());
}

/**
 * Validates that a git scope/path contains only safe characters.
 * Shell metacharacters (; | $ ` \ ' " ( ) { } < > & #) are rejected.
 */
export function isValidGitScope(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[a-zA-Z0-9_./-]+$/.test(value);
}

/**
 * Validates that a value is a valid Git SHA hash (SHA-1 or SHA-256).
 * Only lowercase/uppercase hexadecimal characters, exactly 40 or 64 characters.
 */
export function isValidGitSha(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[a-f0-9]{40}$/i.test(value) || /^[a-f0-9]{64}$/i.test(value);
}
