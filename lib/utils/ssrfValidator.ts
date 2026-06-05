import * as dns from 'dns/promises';

/**
 * Checks whether an IP address belongs to a private, loopback, or cloud-metadata block.
 *
 * Covered ranges:
 * - 10.0.0.0/8 (Private)
 * - 172.16.0.0/12 (Private)
 * - 192.168.0.0/16 (Private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local/Cloud Metadata)
 * - 0.0.0.0/8 (Current network/Broadcast)
 * - ::1/128 (IPv6 Loopback)
 * - fc00::/7 (IPv6 Unique Local Addresses)
 * - fe80::/10 (IPv6 Link-local)
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 regex parsing
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const parts = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    if (
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      parts[0] === 127 || // 127.0.0.0/8
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16
      parts[0] === 0 // 0.0.0.0/8
    ) {
      return true;
    }
  }

  // Basic IPv6 checks
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return true; // IPv6 loopback
  }
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // Unique local address
  }
  if (ip.toLowerCase().startsWith('fe8') || ip.toLowerCase().startsWith('fe9') || ip.toLowerCase().startsWith('fea') || ip.toLowerCase().startsWith('feb')) {
    return true; // Link local address
  }

  return false;
}

/**
 * Validates a URL at the network level by resolving its hostname and checking the resolved IP.
 * Defends against Server-Side Request Forgery (SSRF) and DNS rebinding attacks to private IPs.
 *
 * @param urlString The full URL to check.
 * @returns true if safe, false if the URL is invalid or resolves to a restricted IP.
 */
export async function validateSafeUrl(urlString: string): Promise<boolean> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return false; // Invalid URL
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return false;
  }

  const hostname = parsedUrl.hostname;

  try {
    const records = await dns.lookup(hostname, { all: true });
    
    // Check all resolved IPs for the hostname
    for (const record of records) {
      if (isPrivateIP(record.address)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    // If DNS resolution fails, consider it unsafe
    return false;
  }
}
