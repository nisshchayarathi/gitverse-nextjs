import { SecurityAuditEntry } from "../../types/network-security";

export class SecurityAudit {
  private static mockMetrics = {
    ssrfAttempts: 0,
    blockedOutboundRequests: 0,
    invalidDestinations: 0,
    metadataAccessAttempts: 0,
  };

  /**
   * Masks sensitive credentials or tokens in URLs before logging them.
   */
  public static maskUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      if (url.username || url.password) {
        url.username = '***';
        url.password = '***';
      }
      // Mask standard query parameters that might contain tokens
      const sensitiveKeys = ['token', 'secret', 'key', 'auth', 'signature', 'sig'];
      for (const key of url.searchParams.keys()) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          url.searchParams.set(key, '***');
        }
      }
      return url.toString();
    } catch {
      // If not a valid URL, replace common token patterns
      return urlStr.replace(/(token|auth|key|secret|signature)=[^&]+/gi, '$1=***');
    }
  }

  /**
   * Logs a security audit entry with structured logs.
   */
  public static log(entry: Omit<SecurityAuditEntry, 'timestamp'>): void {
    const timestamp = new Date().toISOString();
    const maskedUrl = this.maskUrl(entry.url);
    
    // Update metrics
    if (entry.event === 'ssrf_attempt') {
      this.mockMetrics.ssrfAttempts++;
      this.mockMetrics.blockedOutboundRequests++;
    } else if (entry.event === 'allowlist_violation') {
      this.mockMetrics.blockedOutboundRequests++;
    } else if (entry.event === 'invalid_destination') {
      this.mockMetrics.invalidDestinations++;
      this.mockMetrics.blockedOutboundRequests++;
    } else if (entry.event === 'metadata_access_attempt') {
      this.mockMetrics.metadataAccessAttempts++;
      this.mockMetrics.ssrfAttempts++;
      this.mockMetrics.blockedOutboundRequests++;
    }

    const logPayload = {
      timestamp,
      severity: entry.severity,
      event: entry.event,
      url: maskedUrl,
      hostname: entry.hostname,
      resolvedIps: entry.resolvedIps,
      reason: entry.reason,
    };

    // Print highly visible security log
    console.error(`[SECURITY AUDIT] [${entry.severity.toUpperCase()}] Event: ${entry.event} - Reason: ${entry.reason}`, JSON.stringify(logPayload));
  }

  /**
   * Retrieves security audit metrics.
   */
  public static getMetrics() {
    return { ...this.mockMetrics };
  }
}
