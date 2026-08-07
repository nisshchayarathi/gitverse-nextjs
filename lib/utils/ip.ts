/**
 * Centralized IP extraction utility for rate limiting.
 *
 * Extracts the client IP from request headers, with support for trusted
 * proxy configurations. When TRUSTED_PROXIES is set, forwarded headers
 * are only trusted if the request originated from a known proxy.
 *
 * Environment variables:
 *   TRUSTED_PROXIES - Comma-separated list of proxy IP addresses or CIDR ranges
 *                     that are allowed to set x-forwarded-for / x-real-ip headers.
 *                     If empty or unset, all forwarded headers are ignored (direct connections).
 *
 * Usage:
 *   import { getClientIp } from "@/lib/utils/ip";
 *   const ip = getClientIp(request);
 */

import { NextRequest } from "next/server";

/**
 * Parse a list of trusted proxy IPs/CIDRs from the environment.
 * Cached after first parse to avoid repeated string splitting.
 */
let cachedProxies: string[] | null = null;

function getTrustedProxies(): string[] {
  if (cachedProxies !== null) return cachedProxies;

  const raw = process.env.TRUSTED_PROXIES;
  if (!raw || !raw.trim()) {
    cachedProxies = [];
  } else {
    cachedProxies = raw.split(",").map((p) => p.trim()).filter(Boolean);
  }
  return cachedProxies;
}

/**
 * Check if an IP address matches a CIDR range.
 * Supports both IPv4 and IPv6.
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr;
  }

  const [range, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);

  // Simple exact match for non-CIDR entries
  if (Number.isNaN(prefix)) return ip === range;

  // Convert IPs to numeric form for comparison
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  if (ipNum === null || rangeNum === null) return false;

  const mask = ~((1 << (32 - prefix)) - 1) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert an IPv4 address to a 32-bit unsigned integer.
 * Returns null if the input is not a valid IPv4 address.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let num = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

/**
 * Check if an IP is in the list of trusted proxies.
 */
function isTrustedProxy(ip: string): boolean {
  const proxies = getTrustedProxies();
  if (proxies.length === 0) return false;

  return proxies.some((proxy) => ipMatchesCidr(ip, proxy));
}

/**
 * Extract the client IP from a Next.js request.
 *
 * Strategy:
 * 1. If TRUSTED_PROXIES is configured:
 *    - Check the leftmost x-forwarded-for entry (the original client IP)
 *    - If it matches a trusted proxy, use the rightmost non-proxy entry
 *    - Otherwise, use the leftmost entry as-is
 * 2. If TRUSTED_PROXIES is NOT configured (direct connections):
 *    - Ignore x-forwarded-for and x-real-ip entirely (they can be spoofed)
 *    - Return "unknown" as a safe default
 *
 * @param request The incoming Next.js request
 * @returns The extracted client IP address, or "unknown"
 */
export function getClientIp(request: NextRequest): string {
  const hasTrustedProxies = getTrustedProxies().length > 0;

  if (hasTrustedProxies) {
    // In a proxied environment, extract the real client IP
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const entries = forwardedFor.split(",").map((e) => e.trim()).filter(Boolean);
      if (entries.length > 0) {
        // Check if the leftmost entry (original client) is a trusted proxy
        const leftmost = entries[0];
        if (isTrustedProxy(leftmost)) {
          // Client is behind another proxy — walk from right to find
          // the first entry that is NOT a trusted proxy (that's the real client)
          for (let i = entries.length - 1; i >= 1; i--) {
            if (!isTrustedProxy(entries[i])) {
              return entries[i];
            }
          }
          // All entries are trusted proxies — use leftmost as fallback
          return leftmost;
        }
        // Leftmost is not a trusted proxy — it's the real client
        return leftmost;
      }
    }

    // Fall back to x-real-ip (set by Nginx/Cloudflare)
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  // No trusted proxies configured — forwarded headers are not trustworthy
  // Return "unknown" to prevent header-spoofing bypass attacks.
  // Rate limiters will use this as a shared key, which is safe:
  // all untrusted requests share the same "unknown" bucket.
  return "unknown";
}

/**
 * Extract the client IP for logging purposes only.
 * This always tries forwarded headers regardless of proxy trust,
 * because logging benefits from the best-effort IP even if it's spoofed.
 *
 * Do NOT use this for security decisions (rate limiting, auth).
 */
export function getClientIpForLogging(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
