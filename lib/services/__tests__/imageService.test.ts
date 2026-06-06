import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
  generateAvatarFilename,
  fileToBuffer,
} from "../imageService";
import { validateSafeUrl } from "@/lib/utils/ssrfValidator";

jest.mock("@/lib/utils/ssrfValidator", () => ({
  validateSafeUrl: jest.fn(),
}));

describe("imageService", () => {
  describe("validateImageFile", () => {
    it("returns error when no file is provided", () => {
      const result = validateImageFile(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    it("accepts valid JPEG files", () => {
      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepts valid PNG files", () => {
      const file = new File(["test"], "avatar.png", { type: "image/png" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepts valid WebP files", () => {
      const file = new File(["test"], "avatar.webp", { type: "image/webp" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepts valid GIF files", () => {
      const file = new File(["test"], "avatar.gif", { type: "image/gif" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("rejects non-image files", () => {
      const file = new File(["test"], "document.pdf", {
        type: "application/pdf",
      });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("rejects files exceeding size limit", () => {
      const largeContent = new ArrayBuffer(600 * 1024); // 600 KB
      const file = new File([largeContent], "large.jpg", {
        type: "image/jpeg",
      });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("accepts files within size limit", () => {
      const content = new ArrayBuffer(100 * 1024); // 100 KB
      const file = new File([content], "small.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateDataUrl", () => {
    it("accepts valid JPEG data URL", () => {
      const dataUrl =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAA";
      const result = validateDataUrl(dataUrl);
      expect(result.valid).toBe(true);
    });

    it("accepts valid PNG data URL", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = validateDataUrl(dataUrl);
      expect(result.valid).toBe(true);
    });

    it("rejects non-data URLs", () => {
      const result = validateDataUrl("https://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid data URL format");
    });

    it("rejects invalid MIME types", () => {
      const dataUrl = "data:application/pdf;base64,JVBERi0xLjQK";
      const result = validateDataUrl(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image type");
    });

    it("rejects data URLs without base64 data", () => {
      const result = validateDataUrl("data:image/jpeg;base64,");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("no base64 data");
    });

    it("rejects oversized data URLs", () => {
      // Create a data URL that exceeds 500KB
      const largeBase64 = "A".repeat(700 * 1024); // ~525KB when decoded
      const dataUrl = `data:image/jpeg;base64,${largeBase64}`;
      const result = validateDataUrl(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image too large");
    });
  });

  describe("validateHttpAvatarUrl", () => {
    beforeEach(() => {
      (validateSafeUrl as jest.Mock).mockReset();
      (validateSafeUrl as jest.Mock).mockResolvedValue(true);
    });

    it("accepts valid HTTPS URLs", async () => {
      const result = await validateHttpAvatarUrl(
        "https://example.com/avatars/user123.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("accepts valid HTTP URLs", async () => {
      const result = await validateHttpAvatarUrl(
        "http://example.com/avatars/user123.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("accepts URLs with ports", async () => {
      const result = await validateHttpAvatarUrl(
        "https://example.com:8080/avatars/user.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("accepts URLs with query parameters", async () => {
      const result = await validateHttpAvatarUrl(
        "https://example.com/avatar.jpg?w=200&h=200&fit=crop"
      );
      expect(result.valid).toBe(true);
    });

    it("rejects non-HTTP protocols", async () => {
      const result = await validateHttpAvatarUrl("ftp://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP or HTTPS");
    });

    it("rejects file protocol", async () => {
      const result = await validateHttpAvatarUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP or HTTPS");
    });

    it("rejects javascript protocol", async () => {
      const result = await validateHttpAvatarUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
    });

    it("rejects invalid URLs", async () => {
      const result = await validateHttpAvatarUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    it("rejects empty strings", async () => {
      const result = await validateHttpAvatarUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    it("rejects URLs without valid hostname", async () => {
      const result = await validateHttpAvatarUrl("http://localhost/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL hostname");
    });

    it("rejects URLs without hostname", async () => {
      const result = await validateHttpAvatarUrl("http:///path");
      expect(result.valid).toBe(false);
    });

    it("rejects URLs that fail SSRF validation", async () => {
      (validateSafeUrl as jest.Mock).mockResolvedValue(false);

      const result = await validateHttpAvatarUrl(
        "http://169.254.169.254/latest/meta-data/"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("restricted address");
    });

    it("rejects IPv6 literal URLs (no dot in hostname)", async () => {
      const result = await validateHttpAvatarUrl("http://[::1]/config");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL hostname");
    });

    it("rejects URLs when validateSafeUrl throws", async () => {
      (validateSafeUrl as jest.Mock).mockRejectedValue(new Error("DNS error"));

      const result = await validateHttpAvatarUrl(
        "https://example.com/avatar.jpg"
      );
      expect(result.valid).toBe(false);
    });

    it("calls validateSafeUrl with the avatar URL", async () => {
      const url = "https://avatars.example.com/user.jpg";
      await validateHttpAvatarUrl(url);
      expect(validateSafeUrl).toHaveBeenCalledWith(url);
    });

    it("does not call validateSafeUrl for non-HTTP URLs", async () => {
      await validateHttpAvatarUrl("ftp://example.com/file.jpg");
      expect(validateSafeUrl).not.toHaveBeenCalled();
    });

    it("does not call validateSafeUrl for invalid URLs", async () => {
      await validateHttpAvatarUrl("not-a-url");
      expect(validateSafeUrl).not.toHaveBeenCalled();
    });

    it("does not call validateSafeUrl for URLs without valid hostname", async () => {
      await validateHttpAvatarUrl("http://localhost/image.jpg");
      expect(validateSafeUrl).not.toHaveBeenCalled();
    });

    it("handles HTTPS URLs with authentication credentials", async () => {
      const result = await validateHttpAvatarUrl(
        "https://user:pass@example.com/avatar.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("handles URLs with fragments", async () => {
      const result = await validateHttpAvatarUrl(
        "https://example.com/avatar.jpg#section"
      );
      expect(result.valid).toBe(true);
    });

    it("handles URL-encoded characters in path", async () => {
      const result = await validateHttpAvatarUrl(
        "https://example.com/avatars/user%20avatar.jpg"
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("generateAvatarFilename", () => {
    it("generates filename with userId and timestamp", () => {
      const filename = generateAvatarFilename(123, "avatar.jpg");
      expect(filename).toMatch(/^avatars\/123\/\d+\.jpg$/);
    });

    it("preserves file extension", () => {
      const filename = generateAvatarFilename(123, "photo.png");
      expect(filename).toMatch(/\.png$/);
    });

    it("defaults to jpg extension", () => {
      const filename = generateAvatarFilename(123, "avatar");
      expect(filename).toContain(".jpg");
    });
  });

  describe("fileToBuffer", () => {
    it("converts file content to Buffer", async () => {
      // Note: jsdom File doesn't support arrayBuffer(), so we test the logic
      // by creating a mock file with arrayBuffer method
      const content = "test content";
      const buffer = Buffer.from(content);
      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(buffer.buffer),
      } as any;
      const result = await fileToBuffer(mockFile);
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
