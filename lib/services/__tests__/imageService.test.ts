import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
  generateAvatarFilename,
  fileToBuffer,
} from "../imageService";

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
    it("accepts valid HTTPS URLs", () => {
      const result = validateHttpAvatarUrl(
        "https://example.com/avatars/user123.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("accepts valid HTTP URLs", () => {
      const result = validateHttpAvatarUrl(
        "http://example.com/avatars/user123.jpg"
      );
      expect(result.valid).toBe(true);
    });

    it("rejects non-HTTP protocols", () => {
      const result = validateHttpAvatarUrl("ftp://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP or HTTPS");
    });

    it("rejects invalid URLs", () => {
      const result = validateHttpAvatarUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    it("rejects URLs without valid hostname", () => {
      const result = validateHttpAvatarUrl("http://localhost/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL hostname");
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
