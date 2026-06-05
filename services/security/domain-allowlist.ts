export class DomainAllowlist {
  private static defaultDomains = [
    'github.com',
    'api.github.com',
    'hooks.slack.com',
    'raw.githubusercontent.com'
  ];

  /**
   * Checks if a domain is allowed under the configured ALLOWED_WEBHOOK_DOMAINS env var.
   */
  public static isAllowed(domain: string): boolean {
    const normalizedDomain = domain.trim().toLowerCase();

    // Retrieve domains list from environment
    const envVar = process.env.ALLOWED_WEBHOOK_DOMAINS;
    let allowedList = this.defaultDomains;

    if (envVar) {
      allowedList = envVar
        .split(/[,\s]+/)
        .map(d => d.trim().toLowerCase())
        .filter(Boolean);
    }

    for (const pattern of allowedList) {
      if (this.matchDomain(normalizedDomain, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if a domain matches a pattern, supporting wildcards (e.g. *.github.com).
   */
  private static matchDomain(domain: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.substring(2);
      return domain === baseDomain || domain.endsWith('.' + baseDomain);
    }

    return domain === pattern;
  }
}
