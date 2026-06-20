import { IPValidator } from "../../../services/security/ip-validator";
import { DNSValidator } from "../../../services/security/dns-validator";
import { DomainAllowlist } from "../../../services/security/domain-allowlist";
import { SafeHttpClient } from "../../../services/security/safe-http-client";
import dns from "dns";

jest.mock("dns", () => {
  const actualDns = jest.requireActual("dns");
  return {
    ...actualDns,
    promises: {
      ...actualDns.promises,
      lookup: jest.fn(),
    },
  };
});

describe("SSRF Vulnerability & Protection Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ALLOWED_WEBHOOK_DOMAINS = "github.com,api.github.com,hooks.slack.com";
  });

  describe("IPValidator", () => {
    it("allows public IP address", () => {
      const result = IPValidator.validate("140.82.113.4"); // github.com public IP
      expect(result.isValid).toBe(true);
      expect(result.isPrivate).toBe(false);
    });

    it("blocks private IPv4 addresses (RFC 1918)", () => {
      const privateIps = ["10.0.0.1", "172.16.0.25", "192.168.1.100"];
      for (const ip of privateIps) {
        const result = IPValidator.validate(ip);
        expect(result.isValid).toBe(false);
        expect(result.isPrivate).toBe(true);
      }
    });

    it("blocks link-local / metadata addresses", () => {
      const metadataIps = ["169.254.169.254", "169.254.0.1"];
      for (const ip of metadataIps) {
        const result = IPValidator.validate(ip);
        expect(result.isValid).toBe(false);
        expect(result.isPrivate).toBe(true);
      }
    });

    it("blocks IPv6 private/local addresses", () => {
      const privateIpv6 = ["::1", "fc00::1", "fe80::1"];
      for (const ip of privateIpv6) {
        const result = IPValidator.validate(ip);
        expect(result.isValid).toBe(false);
        expect(result.isPrivate).toBe(true);
      }
    });
  });

  describe("DomainAllowlist", () => {
    it("allows explicitly defined domains", () => {
      expect(DomainAllowlist.isAllowed("api.github.com")).toBe(true);
      expect(DomainAllowlist.isAllowed("hooks.slack.com")).toBe(true);
    });

    it("supports wildcard subdomains", () => {
      process.env.ALLOWED_WEBHOOK_DOMAINS = "*.github.com";
      expect(DomainAllowlist.isAllowed("api.github.com")).toBe(true);
      expect(DomainAllowlist.isAllowed("github.com")).toBe(true);
      expect(DomainAllowlist.isAllowed("malicious.com")).toBe(false);
    });

    it("blocks unapproved domains", () => {
      expect(DomainAllowlist.isAllowed("evil.com")).toBe(false);
    });
  });

  describe("DNSValidator & SafeHttpClient Validation Flow", () => {
    it("Scenario 1: allows https://api.github.com", async () => {
      (dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "140.82.113.4", family: 4 }]);
      
      const dnsResult = await DNSValidator.resolveAndValidate("api.github.com");
      expect(dnsResult.isValid).toBe(true);
    });

    it("Scenario 2: blocks http://127.0.0.1", async () => {
      const result = IPValidator.validate("127.0.0.1", false);
      expect(result.isValid).toBe(false);
    });

    it("Scenario 3: blocks http://169.254.169.254", async () => {
      const result = IPValidator.validate("169.254.169.254");
      expect(result.isValid).toBe(false);
    });

    it("Scenario 4: blocks http://localhost", async () => {
      const dnsResult = await DNSValidator.resolveAndValidate("localhost", false);
      expect(dnsResult.isValid).toBe(false);
    });

    it("Scenario 5: blocks metadata.google.internal", async () => {
      const dnsResult = await DNSValidator.resolveAndValidate("metadata.google.internal");
      expect(dnsResult.isValid).toBe(false);
      expect(dnsResult.reason).toContain("Metadata hostname blocked");
    });

    it("Scenario 6: blocks when DNS resolves to a private IP", async () => {
      // Mock resolve to loopback/private
      (dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "192.168.1.1", family: 4 }]);

      const dnsResult = await DNSValidator.resolveAndValidate("api.github.com", false);
      expect(dnsResult.isValid).toBe(false);
      expect(dnsResult.reason).toContain("Private IP range blocked");
    });

    it("Scenario 7: allows a valid allowlisted domain", async () => {
      process.env.ALLOWED_WEBHOOK_DOMAINS = "api.github.com";
      (dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "140.82.113.4", family: 4 }]);

      expect(DomainAllowlist.isAllowed("api.github.com")).toBe(true);
      const dnsResult = await DNSValidator.resolveAndValidate("api.github.com");
      expect(dnsResult.isValid).toBe(true);
    });
  });
});
