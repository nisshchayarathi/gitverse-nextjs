import dns from "dns";
import { DNSValidationResult } from "../../types/network-security";
import { IPValidator } from "./ip-validator";

export class DNSValidator {
  public static async resolveAndValidate(
    hostname: string,
    allowLocalhost = false
  ): Promise<DNSValidationResult> {
    // Block localhost/localhost.localdomain explicitly first
    const normalizedHost = hostname.trim().toLowerCase();
    
    if (!allowLocalhost) {
      if (
        normalizedHost === "localhost" ||
        normalizedHost === "localhost.localdomain" ||
        normalizedHost.endsWith(".localhost")
      ) {
        return {
          hostname,
          ips: [],
          isValid: false,
          reason: "Localhost hostname blocked",
        };
      }
    }

    if (normalizedHost === "metadata.google.internal") {
      return {
        hostname,
        ips: [],
        isValid: false,
        reason: "Metadata hostname blocked",
      };
    }

    // Resolve hostname using dns.promises.lookup
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      const ips = addresses.map((addr) => addr.address);

      if (ips.length === 0) {
        return {
          hostname,
          ips,
          isValid: false,
          reason: "DNS resolution returned no IP addresses",
        };
      }

      // Validate each IP
      for (const ip of ips) {
        const ipValidation = IPValidator.validate(ip, allowLocalhost);
        if (!ipValidation.isValid) {
          return {
            hostname,
            ips,
            isValid: false,
            reason: `DNS resolved to blocked IP ${ip}: ${ipValidation.reason}`,
          };
        }
      }

      return {
        hostname,
        ips,
        isValid: true,
      };
    } catch (error: any) {
      return {
        hostname,
        ips: [],
        isValid: false,
        reason: `DNS resolution failed: ${error.message || error}`,
      };
    }
  }
}
