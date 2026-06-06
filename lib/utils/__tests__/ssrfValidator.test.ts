import { isPrivateIP, validateSafeUrl } from "../ssrfValidator";

describe("ssrfValidator", () => {
  describe("isPrivateIP", () => {
    it("returns true for 10.x.x.x addresses", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
      expect(isPrivateIP("10.1.2.3")).toBe(true);
    });

    it("returns true for 172.16.0.0/12 addresses", () => {
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
      expect(isPrivateIP("172.20.0.1")).toBe(true);
    });

    it("returns false for 172.15.0.0/12 addresses", () => {
      expect(isPrivateIP("172.15.0.1")).toBe(false);
      expect(isPrivateIP("172.32.0.1")).toBe(false);
    });

    it("returns false for 172.15.255.255 just below private range", () => {
      expect(isPrivateIP("172.15.255.255")).toBe(false);
    });

    it("returns false for 172.32.0.0 just above private range", () => {
      expect(isPrivateIP("172.32.0.0")).toBe(false);
    });

    it("returns true for 192.168.x.x addresses", () => {
      expect(isPrivateIP("192.168.0.1")).toBe(true);
      expect(isPrivateIP("192.168.255.255")).toBe(true);
      expect(isPrivateIP("192.168.1.100")).toBe(true);
    });

    it("returns false for 192.167.255.255 just below private range", () => {
      expect(isPrivateIP("192.167.255.255")).toBe(false);
    });

    it("returns false for 192.169.0.0 just above private range", () => {
      expect(isPrivateIP("192.169.0.0")).toBe(false);
    });

    it("returns true for 127.x.x.x loopback addresses", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("127.255.255.255")).toBe(true);
      expect(isPrivateIP("127.0.0.2")).toBe(true);
      expect(isPrivateIP("127.0.0.0")).toBe(true);
    });

    it("returns false for 128.0.0.1 just outside loopback range", () => {
      expect(isPrivateIP("128.0.0.1")).toBe(false);
    });

    it("returns true for 169.254.x.x link-local addresses", () => {
      expect(isPrivateIP("169.254.0.1")).toBe(true);
      expect(isPrivateIP("169.254.169.254")).toBe(true);
      expect(isPrivateIP("169.254.255.255")).toBe(true);
      expect(isPrivateIP("169.254.0.0")).toBe(true);
    });

    it("returns false for 169.253.255.255 just below link-local range", () => {
      expect(isPrivateIP("169.253.255.255")).toBe(false);
    });

    it("returns false for 169.255.0.0 just above link-local range", () => {
      expect(isPrivateIP("169.255.0.0")).toBe(false);
    });

    it("returns true for 0.x.x.x addresses", () => {
      expect(isPrivateIP("0.0.0.0")).toBe(true);
      expect(isPrivateIP("0.1.2.3")).toBe(true);
      expect(isPrivateIP("0.255.255.255")).toBe(true);
    });

    it("returns false for public IPv4 addresses", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
      expect(isPrivateIP("93.184.216.34")).toBe(false);
      expect(isPrivateIP("198.51.100.1")).toBe(false);
      expect(isPrivateIP("203.0.113.1")).toBe(false);
    });

    it("returns true for IPv6 loopback", () => {
      expect(isPrivateIP("::1")).toBe(true);
      expect(isPrivateIP("0:0:0:0:0:0:0:1")).toBe(true);
    });

    it("returns true for IPv6 unique local addresses", () => {
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("fd00::1")).toBe(true);
      expect(isPrivateIP("fd12:3456:7890::1")).toBe(true);
      expect(isPrivateIP("fcff::1")).toBe(true);
    });

    it("returns false for IPv6 addresses starting with f8 or f9", () => {
      expect(isPrivateIP("f800::1")).toBe(false);
      expect(isPrivateIP("f900::1")).toBe(false);
    });

    it("returns true for IPv6 link-local addresses", () => {
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("fe90::1")).toBe(true);
      expect(isPrivateIP("fea0::1")).toBe(true);
      expect(isPrivateIP("feb0::1")).toBe(true);
    });

    it("returns false for fe70::1 just below link-local range", () => {
      expect(isPrivateIP("fe70::1")).toBe(false);
    });

    it("returns false for fec0::1 just above link-local range", () => {
      expect(isPrivateIP("fec0::1")).toBe(false);
    });

    it("returns false for public IPv6 addresses", () => {
      expect(isPrivateIP("2001:4860:4860::8888")).toBe(false);
      expect(isPrivateIP("2606:4700:4700::1111")).toBe(false);
      expect(isPrivateIP("2a00:1450:4000::1")).toBe(false);
    });

    it("handles non-IP strings gracefully", () => {
      expect(isPrivateIP("not-an-ip")).toBe(false);
      expect(isPrivateIP("")).toBe(false);
      expect(isPrivateIP("abc.def.ghi.jkl")).toBe(false);
    });

    it("handles IP with leading zeros", () => {
      expect(isPrivateIP("10.0.0.01")).toBe(true);
    });

    it("handles malformed IP strings", () => {
      expect(isPrivateIP("10.0.0")).toBe(false);
      expect(isPrivateIP("10.0.0.1.5")).toBe(false);
      expect(isPrivateIP("...")).toBe(false);
    });

    it("IPv6 is case insensitive", () => {
      expect(isPrivateIP("FC00::1")).toBe(true);
      expect(isPrivateIP("FD00::1")).toBe(true);
      expect(isPrivateIP("FE80::1")).toBe(true);
    });
  });

  describe("validateSafeUrl", () => {
    it("returns false for invalid URL strings", async () => {
      const result = await validateSafeUrl("not-a-url");
      expect(result).toBe(false);
    });

    it("returns false for empty string", async () => {
      const result = await validateSafeUrl("");
      expect(result).toBe(false);
    });

    it("returns false for non-HTTP protocols", async () => {
      const result = await validateSafeUrl("ftp://example.com/file.txt");
      expect(result).toBe(false);
    });

    it("returns false for file protocol", async () => {
      const result = await validateSafeUrl("file:///etc/passwd");
      expect(result).toBe(false);
    });

    it("returns false for javascript protocol", async () => {
      const result = await validateSafeUrl("javascript:alert(1)");
      expect(result).toBe(false);
    });

    it("returns false for data protocol", async () => {
      const result = await validateSafeUrl("data:text/html,<script>alert(1)</script>");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to private IP ranges", async () => {
      const result = await validateSafeUrl("http://10.0.0.1/config");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to loopback", async () => {
      const result = await validateSafeUrl("http://127.0.0.1:3000/admin");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to AWS metadata IP", async () => {
      const result = await validateSafeUrl("http://169.254.169.254/latest/meta-data/");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to 192.168.x.x", async () => {
      const result = await validateSafeUrl("http://192.168.1.1/admin");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to 172.16.x.x private range", async () => {
      const result = await validateSafeUrl("http://172.16.0.1/config");
      expect(result).toBe(false);
    });

    it("rejects URLs pointing to 172.31.x.x private range", async () => {
      const result = await validateSafeUrl("http://172.31.255.255/config");
      expect(result).toBe(false);
    });

    it("rejects URLs with authentication credentials to private IPs", async () => {
      const result = await validateSafeUrl("http://user:pass@10.0.0.1/admin");
      expect(result).toBe(false);
    });

    it("rejects URLs with fragment to private IPs", async () => {
      const result = await validateSafeUrl("http://192.168.1.1/admin#section");
      expect(result).toBe(false);
    });

    it("accepts URLs with public IP addresses", async () => {
      const result = await validateSafeUrl("http://93.184.216.34/image.jpg");
      expect(result).toBe(true);
    });

    it("accepts URLs with authentication credentials to public IPs", async () => {
      const result = await validateSafeUrl("http://user:pass@93.184.216.34/image.jpg");
      expect(result).toBe(true);
    });

    it("accepts URLs with public hostnames that resolve externally", async () => {
      const result = await validateSafeUrl("https://example.com/image.jpg");
      expect(result).toBe(true);
    }, 15000);

    it("accepts HTTPS URLs with public hostnames and query parameters", async () => {
      const result = await validateSafeUrl("https://example.com/image.jpg?w=800&h=600&fit=cover");
      expect(result).toBe(true);
    }, 15000);

    it("rejects URLs with private IPv6 loopback", async () => {
      const result = await validateSafeUrl("http://[::1]/admin");
      expect(result).toBe(false);
    });

    it("rejects URLs with IPv6 unique local addresses", async () => {
      const result = await validateSafeUrl("http://[fc00::1]/config");
      expect(result).toBe(false);
    });

    it("rejects URLs with IPv6 link-local addresses", async () => {
      const result = await validateSafeUrl("http://[fe80::1]/config");
      expect(result).toBe(false);
    });

    it("handles URLs with ports and paths correctly", async () => {
      const result = await validateSafeUrl("https://example.com:8080/path/to/file.jpg?w=200");
      expect(result).toBe(true);
    }, 15000);

    it("handles URLs with unusual ports", async () => {
      const result = await validateSafeUrl("http://93.184.216.34:1234/image.jpg");
      expect(result).toBe(true);
    });

    it("rejects URLs with private IP on unusual ports", async () => {
      const result = await validateSafeUrl("http://10.0.0.1:9000/internal");
      expect(result).toBe(false);
    });

    it("handles URLs without a path", async () => {
      const result = await validateSafeUrl("http://93.184.216.34");
      expect(result).toBe(true);
    });

    it("handles URLs with only a trailing slash", async () => {
      const result = await validateSafeUrl("http://93.184.216.34/");
      expect(result).toBe(true);
    });
  });
});
