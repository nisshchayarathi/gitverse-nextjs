import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
  validateImageContent,
  fetchAndValidateAvatarUrl,
  generateAvatarFilename,
  fileToBuffer,
} from "../imageService";
import { validateSafeUrl } from "@/lib/utils/ssrfValidator";

jest.mock("@/lib/utils/ssrfValidator", () => ({
  validateSafeUrl: jest.fn(),
}));

const mockMetadata = jest.fn();
jest.mock("sharp", () => {
  return jest.fn().mockImplementation(() => ({
    metadata: mockMetadata,
  }));
});

function mockValidImageBuffer() {
  mockMetadata.mockResolvedValue({ format: "jpeg" });
}

function mockCorruptedBuffer() {
  mockMetadata.mockRejectedValue(new Error("Input buffer contains unsupported image format"));
}

function mockUnsupportedFormat() {
  mockMetadata.mockResolvedValue({ format: "tiff" });
}

function mockEmptyMetadata() {
  mockMetadata.mockResolvedValue(null);
}

beforeEach(() => {
  mockMetadata.mockReset();
});

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
      const largeContent = new ArrayBuffer(600 * 1024);
      const file = new File([largeContent], "large.jpg", {
        type: "image/jpeg",
      });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("accepts files within size limit", () => {
      const content = new ArrayBuffer(100 * 1024);
      const file = new File([content], "small.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateImageContent", () => {
    it("accepts valid JPEG buffer", async () => {
      mockValidImageBuffer();
      const result = await validateImageContent(Buffer.from("fake-jpeg-data"));
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/jpeg");
    });

    it("accepts valid PNG buffer", async () => {
      mockMetadata.mockResolvedValue({ format: "png" });
      const result = await validateImageContent(Buffer.from("fake-png-data"));
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/png");
    });

    it("accepts valid WebP buffer", async () => {
      mockMetadata.mockResolvedValue({ format: "webp" });
      const result = await validateImageContent(Buffer.from("fake-webp-data"));
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/webp");
    });

    it("accepts valid GIF buffer", async () => {
      mockMetadata.mockResolvedValue({ format: "gif" });
      const result = await validateImageContent(Buffer.from("fake-gif-data"));
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/gif");
    });

    it("rejects null buffer", async () => {
      const result = await validateImageContent(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Empty image data");
    });

    it("rejects empty buffer", async () => {
      const result = await validateImageContent(Buffer.alloc(0));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Empty image data");
    });

    it("rejects oversized buffer", async () => {
      const oversized = Buffer.alloc(600 * 1024);
      const result = await validateImageContent(oversized);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image too large");
    });

    it("rejects corrupted image data", async () => {
      mockCorruptedBuffer();
      const result = await validateImageContent(Buffer.from("garbage-data"));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid or corrupted");
    });

    it("rejects unsupported image format", async () => {
      mockUnsupportedFormat();
      const result = await validateImageContent(Buffer.from("fake-tiff-data"));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image format");
    });

    it("rejects null metadata", async () => {
      mockEmptyMetadata();
      const result = await validateImageContent(Buffer.from("fake-data"));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unable to decode image data");
    });

    it("respects custom allowed mime types", async () => {
      mockMetadata.mockResolvedValue({ format: "png" });
      const result = await validateImageContent(Buffer.from("fake-png"), [
        "image/webp",
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image format");
    });

    it("accepts PNG with custom allowed types that include PNG", async () => {
      mockMetadata.mockResolvedValue({ format: "png" });
      const result = await validateImageContent(Buffer.from("fake-png"), [
        "image/jpeg",
        "image/png",
      ]);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe("image/png");
    });
  });

  describe("validateDataUrl", () => {
    beforeEach(() => {
      mockValidImageBuffer();
    });

    it("accepts valid JPEG data URL", async () => {
      const dataUrl =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAA";
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(true);
    });

    it("accepts valid PNG data URL", async () => {
      mockMetadata.mockResolvedValue({ format: "png" });
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(true);
    });

    it("rejects non-data URLs", async () => {
      const result = await validateDataUrl("https://example.com/image.jpg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid data URL format");
    });

    it("rejects invalid MIME types", async () => {
      const dataUrl = "data:application/pdf;base64,JVBERi0xLjQK";
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image type");
    });

    it("rejects data URLs without base64 data", async () => {
      const result = await validateDataUrl("data:image/jpeg;base64,");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("no base64 data");
    });

    it("rejects oversized data URLs", async () => {
      const largeBase64 = "A".repeat(700 * 1024);
      const dataUrl = `data:image/jpeg;base64,${largeBase64}`;
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image too large");
    });

    it("rejects data URL with corrupted image content", async () => {
      mockCorruptedBuffer();
      const dataUrl =
        "data:image/jpeg;base64,ZGF0YQ==";
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid or corrupted");
    });

    it("returns buffer and mimeType on success", async () => {
      const dataUrl =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAA";
      const result = await validateDataUrl(dataUrl);
      expect(result.valid).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe("image/jpeg");
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

  describe("fetchAndValidateAvatarUrl", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      (validateSafeUrl as jest.Mock).mockReset();
      (validateSafeUrl as jest.Mock).mockResolvedValue(true);
      mockValidImageBuffer();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("fetches and validates a valid avatar URL", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
          ["content-length", "1024"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/avatar.jpg"
      );

      expect(result.valid).toBe(true);
      expect(result.fetched).toBeDefined();
      expect(result.fetched!.buffer).toBeDefined();
      expect(result.fetched!.mimeType).toBe("image/jpeg");
      expect(result.fetched!.originalUrl).toBe(
        "https://cdn.example.com/avatar.jpg"
      );
    });

    it("rejects non-HTTP URLs", async () => {
      const result = await fetchAndValidateAvatarUrl(
        "ftp://cdn.example.com/avatar.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP or HTTPS");
    });

    it("rejects URLs without dot in hostname", async () => {
      const result = await fetchAndValidateAvatarUrl(
        "http://localhost/image.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL hostname");
    });

    it("rejects URLs that fail SSRF validation", async () => {
      (validateSafeUrl as jest.Mock).mockResolvedValue(false);

      const result = await fetchAndValidateAvatarUrl(
        "https://metadata.internal/data"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("restricted address");
    });

    it("rejects non-200 responses", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/missing.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("404");
    });

    it("rejects non-image content types", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "text/html"],
          ["content-length", "500"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/page.html"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not an image");
    });

    it("rejects oversized content-length", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
          ["content-length", String(1024 * 1024)],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/large.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("rejects oversized response body", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(700 * 1024)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/large.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("rejects empty response body", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/empty.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty response");
    });

    it("rejects corrupted image content from remote", async () => {
      mockCorruptedBuffer();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/corrupted.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid or corrupted");
    });

    it("handles fetch network errors", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

      const result = await fetchAndValidateAvatarUrl(
        "https://nonexistent.example.com/image.jpg"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Failed to fetch avatar");
    });

    it("handles fetch abort (timeout)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const result = await fetchAndValidateAvatarUrl(
        "https://slow.example.com/image.jpg",
        1
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("calls validateSafeUrl for valid URLs", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg"],
          ["content-length", "100"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
      });

      const url = "https://cdn.example.com/avatar.jpg";
      await fetchAndValidateAvatarUrl(url);
      expect(validateSafeUrl).toHaveBeenCalledWith(url);
    });

    it("rejects invalid protocol at URL parse stage", async () => {
      const result = await fetchAndValidateAvatarUrl(
        "javascript:alert(1)"
      );
      expect(result.valid).toBe(false);
    });

    it("accepts PNG from remote server", async () => {
      mockMetadata.mockResolvedValue({ format: "png" });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/png"],
          ["content-length", "500"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(300)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/avatar.png"
      );
      expect(result.valid).toBe(true);
      expect(result.fetched!.mimeType).toBe("image/png");
    });

    it("accepts WebP from remote server", async () => {
      mockMetadata.mockResolvedValue({ format: "webp" });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/webp"],
          ["content-length", "400"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(200)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/avatar.webp"
      );
      expect(result.valid).toBe(true);
      expect(result.fetched!.mimeType).toBe("image/webp");
    });

    it("uses content-type without charset for mime type", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "image/jpeg; charset=utf-8"],
          ["content-length", "200"],
        ]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await fetchAndValidateAvatarUrl(
        "https://cdn.example.com/avatar.jpg"
      );
      expect(result.valid).toBe(true);
      expect(result.fetched!.mimeType).toBe("image/jpeg");
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
