/**
 * Repository URL Validator
 * 
 * Handles parsing, validation, and normalization of repository URLs.
 * Supports common GitHub, GitLab, and Bitbucket URL formats including:
 * - HTTPS: https://github.com/owner/repo, https://www.github.com/owner/repo
 * - SSH: git@github.com:owner/repo.git
 * - With or without .git extension
 */

export interface ParsedRepoUrl {
  /** The normalized URL (HTTPS format) */
  normalizedUrl: string;
  /** The platform (github, gitlab, bitbucket) */
  platform: string;
  /** The owner/organization name */
  owner: string;
  /** The repository name */
  repo: string;
  /** The original URL provided by the user */
  originalUrl: string;
}

export interface ValidationResult {
  /** Whether the URL is valid */
  isValid: boolean;
  /** The parsed URL information (if valid) */
  parsed?: ParsedRepoUrl;
  /** Error message explaining what's wrong (if invalid) */
  error?: string;
  /** Suggestions for fixing the URL */
  suggestion?: string;
}

// Supported platforms and their URL patterns
const PLATFORMS = {
  github: {
    domains: ['github.com', 'www.github.com'],
    sshPrefix: 'git@github.com:',
    example: 'https://github.com/owner/repo',
  },
  gitlab: {
    domains: ['gitlab.com', 'www.gitlab.com'],
    sshPrefix: 'git@gitlab.com:',
    example: 'https://gitlab.com/owner/repo',
  },
  bitbucket: {
    domains: ['bitbucket.org', 'www.bitbucket.org'],
    sshPrefix: 'git@bitbucket.org:',
    example: 'https://bitbucket.org/owner/repo',
  },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

// Platform domain mapping for quick lookup
const DOMAIN_TO_PLATFORM: Record<string, PlatformKey> = {
  'github.com': 'github',
  'www.github.com': 'github',
  'gitlab.com': 'gitlab',
  'www.gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
  'www.bitbucket.org': 'bitbucket',
};

/**
 * Validates and parses a repository URL.
 * Returns detailed information including normalized URL and helpful error messages.
 */
export function validateRepoUrl(url: string): ValidationResult {
  // Trim whitespace
  const trimmedUrl = url.trim();

  // Check for empty input
  if (!trimmedUrl) {
    return {
      isValid: false,
      error: 'Repository URL is required.',
      suggestion: 'Please paste a repository URL to continue.',
    };
  }

  // Try to parse the URL
  const parsed = parseRepoUrl(trimmedUrl);

  if (parsed) {
    return {
      isValid: true,
      parsed,
    };
  }

  // URL didn't match any known format - provide helpful error
  return generateHelpfulError(trimmedUrl);
}

/**
 * Parses a repository URL and extracts information.
 * Handles both HTTPS and SSH formats.
 */
function parseRepoUrl(url: string): ParsedRepoUrl | null {
  // Try SSH format: git@host:owner/repo.git
  const sshResult = parseSshUrl(url);
  if (sshResult) return sshResult;

  // Try HTTPS format: https://host/owner/repo
  const httpsResult = parseHttpsUrl(url);
  if (httpsResult) return httpsResult;

  return null;
}

/**
 * Parses SSH-style URLs: git@github.com:owner/repo.git
 */
function parseSshUrl(url: string): ParsedRepoUrl | null {
  // SSH format: git@host:owner/repo[.git]
  const sshRegex = /^git@([^:]+):([\w.-]+)\/([\w.-]+?)(\.git)?$/i;
  const match = url.match(sshRegex);

  if (!match) return null;

  const [, host, owner, repo] = match;
  const platform = detectPlatform(host);

  if (!platform) return null;

  const normalizedUrl = `https://${PLATFORMS[platform].domains[0]}/${owner}/${repo}`;

  return {
    normalizedUrl,
    platform,
    owner,
    repo,
    originalUrl: url,
  };
}

/**
 * Parses HTTPS-style URLs: https://host/owner/repo[.git]
 */
function parseHttpsUrl(url: string): ParsedRepoUrl | null {
  try {
    // Add protocol if missing but starts with a domain
    let urlToParse = url;
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      // Check if it looks like it could be a URL without protocol
      // Support various formats: github.com/owner/repo, www.github.com/owner/repo
      const domainPattern = /^(github\.com|gitlab\.com|bitbucket\.org|www\.github\.com|www\.gitlab\.com|www\.bitbucket\.org)\/[\w-]+\/[\w.-]+/i;
      if (domainPattern.test(urlToParse)) {
        urlToParse = 'https://' + urlToParse;
      } else {
        return null;
      }
    }

    const parsedUrl = new URL(urlToParse);
    const host = parsedUrl.hostname;
    const platform = detectPlatform(host);

    if (!platform) return null;

    // Extract owner/repo from path - remove trailing slashes first, then .git suffix
    const cleanedPath = parsedUrl.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
    const pathParts = cleanedPath.split('/').filter(Boolean);

    if (pathParts.length < 2) return null;

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Validate owner and repo names (basic validation)
    if (!isValidRepoSegment(owner) || !isValidRepoSegment(repo)) {
      return null;
    }

    const normalizedUrl = `https://${PLATFORMS[platform].domains[0]}/${owner}/${repo}`;

    return {
      normalizedUrl,
      platform,
      owner,
      repo,
      originalUrl: url,
    };
  } catch {
    return null;
  }
}

/**
 * Detects the platform from the hostname.
 */
function detectPlatform(host: string): PlatformKey | null {
  const lowerHost = host.toLowerCase();
  return DOMAIN_TO_PLATFORM[lowerHost] || null;
}

/**
 * Validates a repository name segment (owner or repo name).
 */
function isValidRepoSegment(segment: string): boolean {
  // Basic validation: alphanumeric, hyphens, underscores, dots
  // Must start with alphanumeric
  return /^[a-zA-Z0-9][\w.-]*$/.test(segment) && segment.length <= 100;
}

/**
 * Generates a helpful error message based on common input patterns.
 */
function generateHelpfulError(url: string): ValidationResult {
  // Check if it's an SSH URL but with wrong format
  if (url.startsWith('git@')) {
    return {
      isValid: false,
      error: 'Invalid SSH URL format.',
      suggestion: 'SSH URLs should be in the format: git@github.com:owner/repo.git',
    };
  }

  // Check if it looks like a URL but for an unsupported platform
  if (url.includes('://') || url.startsWith('www.')) {
    const unsupportedPlatforms = [
      { pattern: /gitlab\./i, name: 'GitLab' },
      { pattern: /bitbucket\./i, name: 'Bitbucket' },
      { pattern: /github\./i, name: 'GitHub' },
    ];

    for (const { pattern, name } of unsupportedPlatforms) {
      if (pattern.test(url)) {
        // It matches a platform but our parser failed - likely invalid format
        return {
          isValid: false,
          error: `Could not parse ${name} repository URL.`,
          suggestion: `Please use a URL like: https://${name.toLowerCase()}.com/owner/repo`,
        };
      }
    }

    return {
      isValid: false,
      error: 'URL is not from a supported platform.',
      suggestion: 'Please use a GitHub, GitLab, or Bitbucket repository URL.',
    };
  }

  // Check if it looks like it could be owner/repo shorthand
  if (/^[\w-]+\/[\w.-]+$/.test(url)) {
    return {
      isValid: false,
      error: 'Incomplete URL format.',
      suggestion: `Please include the full URL, e.g., https://github.com/${url}`,
    };
  }

  // Check if it's just a repository name
  if (/^[\w.-]+$/.test(url) && !url.includes('/')) {
    return {
      isValid: false,
      error: 'Repository name alone is not sufficient.',
      suggestion: `Please provide the full repository URL, e.g., https://github.com/owner/${url}`,
    };
  }

  // Generic error
  return {
    isValid: false,
    error: 'Invalid repository URL format.',
    suggestion: `Accepted formats:\n  • HTTPS: https://github.com/owner/repo\n  • SSH: git@github.com:owner/repo.git`,
  };
}

/**
 * Quick validation - returns true/false only.
 * Useful for simple checks where detailed error messages aren't needed.
 */
export function isValidRepoUrl(url: string): boolean {
  return validateRepoUrl(url).isValid;
}

/**
 * Normalizes a repository URL to a standard HTTPS format.
 * Returns the original URL if it cannot be parsed.
 */
export function normalizeRepoUrl(url: string): string {
  const result = validateRepoUrl(url);
  return result.parsed?.normalizedUrl || url;
}

/**
 * Extracts repository information from a URL.
 * Returns null if the URL is invalid.
 */
export function extractRepoInfo(url: string): { platform: string; owner: string; repo: string } | null {
  const result = validateRepoUrl(url);
  if (result.parsed) {
    return {
      platform: result.parsed.platform,
      owner: result.parsed.owner,
      repo: result.parsed.repo,
    };
  }
  return null;
}