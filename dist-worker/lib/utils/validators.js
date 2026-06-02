"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidGithubUrl = isValidGithubUrl;
exports.isValidGitScope = isValidGitScope;
/**
 * Validates whether a given string is a strictly malformed or well-formed public GitHub repository URL.
 * Matches:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo/
 * - https://www.github.com/owner/repo.git
 */
function isValidGithubUrl(url) {
    if (!url || typeof url !== "string")
        return false;
    // Strict regex accounting for subdomains (www.), optional trailing slashes, and optional .git extensions.
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-._]+\/[a-zA-Z0-9-._]+(\.git)?\/?$/;
    return githubRegex.test(url.trim());
}
/**
 * Validates that a git scope/path contains only safe characters.
 * Shell metacharacters (; | $ ` \ ' " ( ) { } < > & #) are rejected.
 */
function isValidGitScope(value) {
    if (!value || typeof value !== "string")
        return false;
    return /^[a-zA-Z0-9_./-]+$/.test(value);
}
