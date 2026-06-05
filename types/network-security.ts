export interface IPValidationResult {
  ip: string;
  isPrivate: boolean;
  isValid: boolean;
  reason?: string;
}

export interface DNSValidationResult {
  hostname: string;
  ips: string[];
  isValid: boolean;
  reason?: string;
}

export interface SecurityAuditEntry {
  timestamp: string;
  event: 'ssrf_attempt' | 'allowlist_violation' | 'invalid_destination' | 'metadata_access_attempt';
  url: string;
  hostname: string;
  resolvedIps?: string[];
  reason: string;
  severity: 'high' | 'critical';
}

export interface SafeHttpClientOptions extends RequestInit {
  allowLocalhost?: boolean; // Useful for local development
}
