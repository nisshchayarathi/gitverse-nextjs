import { IPValidationResult } from "../../types/network-security";

/**
 * Checks if an IPv4 address is within a CIDR range.
 */
function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [rangeIp, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    const ipNum = ipv4ToLong(ip);
    const rangeNum = ipv4ToLong(rangeIp);
    
    const mask = bits === 0 ? 0 : (~0 << (32 - bits));
    
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Converts IPv4 address to 32-bit integer.
 */
function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) {
    throw new Error('Invalid IPv4 address');
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Checks if an IPv6 address is in a CIDR range.
 */
function ip6InCidr(ip: string, cidr: string): boolean {
  try {
    const [rangeIp, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    const ipBlocks = parseIpv6(ip);
    const rangeBlocks = parseIpv6(rangeIp);
    
    let remainingBits = bits;
    for (let i = 0; i < 8; i++) {
      if (remainingBits <= 0) break;
      
      const maskBits = Math.min(remainingBits, 16);
      const mask = maskBits === 0 ? 0 : (0xffff << (16 - maskBits)) & 0xffff;
      
      if ((ipBlocks[i] & mask) !== (rangeBlocks[i] & mask)) {
        return false;
      }
      remainingBits -= 16;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses IPv6 address into 8 16-bit blocks.
 */
function parseIpv6(ip: string): number[] {
  let address = ip.toLowerCase();
  
  // Handle double colon expansion
  if (address.includes('::')) {
    const parts = address.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    const middle = Array(missing).fill('0');
    address = [...left, ...middle, ...right].join(':');
  }
  
  const blocks = address.split(':').map(b => parseInt(b || '0', 16));
  if (blocks.length !== 8 || blocks.some(isNaN)) {
    throw new Error('Invalid IPv6 address');
  }
  return blocks;
}

export class IPValidator {
  private static privateIpv4Ranges = [
    '127.0.0.0/8',      // Loopback
    '10.0.0.0/8',       // Private Class A
    '172.16.0.0/12',    // Private Class B
    '192.168.0.0/16',   // Private Class C
    '169.254.0.0/16',   // Link-local
    '0.0.0.0/8'         // Current network
  ];

  private static privateIpv6Ranges = [
    '::1/128',          // Loopback
    'fc00::/7',         // Unique Local Address
    'fe80::/10',        // Link-local
    '::/128'            // Unspecified
  ];

  private static blockedSpecificIps = [
    '169.254.169.254'   // Cloud metadata API
  ];

  public static validate(ip: string, allowLocalhost = false): IPValidationResult {
    // Basic IP formats checking
    const isIpv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
    const isIpv6 = ip.includes(':');

    if (!isIpv4 && !isIpv6) {
      return {
        ip,
        isPrivate: false,
        isValid: false,
        reason: 'Invalid IP address format'
      };
    }

    // Direct loopback check (unless explicitly allowed for development)
    if (!allowLocalhost) {
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return {
          ip,
          isPrivate: true,
          isValid: false,
          reason: 'Loopback address blocked'
        };
      }
    }

    if (this.blockedSpecificIps.includes(ip)) {
      return {
        ip,
        isPrivate: true,
        isValid: false,
        reason: 'Metadata endpoint blocked'
      };
    }

    if (isIpv4) {
      // Check IPv4 CIDRs
      for (const cidr of this.privateIpv4Ranges) {
        if (ipInCidr(ip, cidr)) {
          const isLoopback = cidr.startsWith('127.');
          if (isLoopback && allowLocalhost) {
            continue;
          }
          return {
            ip,
            isPrivate: true,
            isValid: false,
            reason: `Private IP range blocked: ${cidr}`
          };
        }
      }
    } else {
      // Check IPv6 CIDRs
      for (const cidr of this.privateIpv6Ranges) {
        if (ip6InCidr(ip, cidr)) {
          if (cidr.startsWith('::1') && allowLocalhost) {
            continue;
          }
          return {
            ip,
            isPrivate: true,
            isValid: false,
            reason: `Private IPv6 range blocked: ${cidr}`
          };
        }
      }
    }

    return {
      ip,
      isPrivate: false,
      isValid: true
    };
  }
}
