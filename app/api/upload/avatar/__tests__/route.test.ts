/**
 * @jest-environment node
 */

let mockCheckRateLimit: jest.Mock;
let mockRateLimitResponse: jest.Mock;

jest.mock("@/lib/middleware/rateLimit", () => ({
  checkRateLimit: (...args: any[]) => {
    if (!mockCheckRateLimit) throw new Error("mockCheckRateLimit not initialized");
    return mockCheckRateLimit(...args);
  },
  rateLimitResponse: (...args: any[]) => {
    if (!mockRateLimitResponse) throw new Error("mockRateLimitResponse not initialized");
    return mockRateLimitResponse(...args);
  },
  RATE_LIMITS: {
    AVATAR_UPLOAD: { namespace: "upload:avatar", maxRequests: 5, windowMs: 3_600_000 },
  },
}));

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/services/imageService", () => ({
  validateImageFile: jest.fn(),
  validateDataUrl: jest.fn(),
  validateHttpAvatarUrl: jest.fn(),
  fetchAndValidateAvatarUrl: jest.fn(),
  validateImageContent: jest.fn(),
}));

jest.mock("@/lib/services/storageService", () => ({
  storeAvatar: jest.fn(),
  parseDataUrl: jest.fn(),
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/middleware";
import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
  fetchAndValidateAvatarUrl,
  validateImageContent,
} from "@/lib/services/imageService";
import { storeAvatar, parseDataUrl } from "@/lib/services/storageService";
import { NextRequest } from "next/server";

const undici = require("undici");
(global as any).Request = undici.Request;
(global as any).Response = undici.Response;

describe("POST /api/upload/avatar", () => {
  const mockUser = { userId: 123, email: "test@example.com" };
  const mockStored = {
    url: "/uploads/avatars/123/1700000000_abc123.jpg",
    filePath: "/app/public/uploads/avatars/123/1700000000_abc123.jpg",
  };

  beforeEach(() => {
    mockCheckRateLimit = jest.fn();
    mockRateLimitResponse = jest.fn();
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (storeAvatar as jest.Mock).mockResolvedValue(mockStored);
    (validateImageContent as jest.Mock).mockResolvedValue({ valid: true, mimeType: "image/png" });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4, limit: 5, resetAt: Date.now() + 3600000 });
    mockRateLimitResponse.mockReturnValue(
      new Response(JSON.stringify({ error: true, message: "Too many requests", code: 429 }), { status: 429 })
    );
  });

  describe("Authentication", () => {
    it("returns error when user is not authenticated", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/avatar.jpg" }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.error).toBe(true);
    });
  });

  describe("Content-type handling", () => {
    it("returns 415 for unsupported content types", async () => {
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "test",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(415);
      expect(data.error).toBe(true);
      expect(data.message).toContain("Unsupported content type");
    });
  });

  describe("File upload", () => {
    it("returns 400 when no file is provided", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({
        valid: false,
        error: "No file provided",
      });

      const formData = new FormData();
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toBe("No file provided");
    });

    it("returns 400 for invalid file type", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({
        valid: false,
        error: "Invalid file type",
      });

      const file = new File(["test"], "document.pdf", { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
    });

    it("returns 400 for oversized files", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({
        valid: false,
        error: "File too large. Maximum size: 500KB",
      });

      const largeContent = new ArrayBuffer(600 * 1024);
      const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toContain("File too large");
    });

    it("returns 200 and stores valid file upload on disk", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toBe(mockStored.url);
      expect(storeAvatar).toHaveBeenCalledTimes(1);
      expect(storeAvatar).toHaveBeenCalledWith(
        expect.any(Buffer),
        mockUser.userId,
        "image/jpeg",
      );
    });

    it("does not return a base64 data URL in the response", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.avatarUrl).not.toMatch(/^data:image/);
      expect(data.avatarUrl).toMatch(/^\/uploads\/avatars\//);
    });

    it("passes correct buffer content to storeAvatar", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const content = "fake-image-bytes";
      const file = new File([content], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      const callArg = (storeAvatar as jest.Mock).mock.calls[0][0];
      expect(Buffer.isBuffer(callArg)).toBe(true);
      expect(callArg.toString()).toBe(content);
    });
  });

  describe("Data URL upload", () => {
    beforeEach(() => {
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("decoded-image-data"),
        mimeType: "image/png",
      });
    });

    it("returns 400 for invalid data URL", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({
        valid: false,
        error: "Invalid data URL format",
      });

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "not-a-data-url" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toContain("Invalid data URL");
    });

    it("stores decoded data URL on disk and returns URL", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("decoded"),
        mimeType: "image/png",
      });

      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toBe(mockStored.url);
      expect(storeAvatar).toHaveBeenCalledWith(
        expect.any(Buffer),
        mockUser.userId,
        "image/png",
      );
    });

    it("does not store raw data URL in response", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });

      const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAA";
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.avatarUrl).not.toBe(dataUrl);
      expect(data.avatarUrl).toMatch(/^\/uploads\/avatars\//);
    });

    it("returns 400 when parseDataUrl returns null", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue(null);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "data:image/png;base64,abc" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("Failed to parse data URL");
    });

    it("validates dataUrl before attempting to parse", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({
        valid: false,
        error: "Invalid data URL",
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "invalid" }),
      }));

      expect(parseDataUrl).not.toHaveBeenCalled();
      expect(storeAvatar).not.toHaveBeenCalled();
    });
  });

  describe("HTTP URL upload", () => {
    it("returns 400 for invalid HTTP URL", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockReturnValue({
        valid: false,
        error: "Invalid URL format",
      });

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toContain("Invalid URL");
    });

    it("returns 200 and stores fetched URL content locally", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: true });
      (fetchAndValidateAvatarUrl as jest.Mock).mockResolvedValue({
        valid: true,
        fetched: {
          buffer: Buffer.from("fetched-image-data"),
          mimeType: "image/jpeg",
          originalUrl: "https://example.com/avatars/user123.jpg",
        },
      });

      const url = "https://example.com/avatars/user123.jpg";
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toBe(mockStored.url);
      expect(storeAvatar).toHaveBeenCalledWith(
        expect.any(Buffer),
        mockUser.userId,
        "image/jpeg",
      );
    });

    it("returns 400 when neither dataUrl nor url is provided", async () => {
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toContain("Either 'dataUrl' or 'url'");
    });

    it("calls storeAvatar after fetching URL content", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: true });
      (fetchAndValidateAvatarUrl as jest.Mock).mockResolvedValue({
        valid: true,
        fetched: {
          buffer: Buffer.from("data"),
          mimeType: "image/jpeg",
          originalUrl: "https://example.com/avatar.jpg",
        },
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/avatar.jpg" }),
      }));

      expect(fetchAndValidateAvatarUrl).toHaveBeenCalled();
      expect(storeAvatar).toHaveBeenCalled();
    });
  });

  describe("Rate limiting", () => {
    it("passes userId to checkRateLimit", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        String(mockUser.userId),
        expect.objectContaining({ namespace: "upload:avatar" }),
      );
    });

    it("returns 429 when rate limited", async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, limit: 5, resetAt: Date.now() + 3600000 });

      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      expect(response.status).toBe(429);
      expect(mockRateLimitResponse).toHaveBeenCalled();
    });
  });

  describe("Error response format", () => {
    it("returns consistent error format on validation failure", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({
        valid: false,
        error: "Invalid data URL",
      });

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "invalid" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty("error", true);
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("code");
    });

    it("returns error when storeAvatar throws", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });
      (storeAvatar as jest.Mock).mockRejectedValue(new Error("Disk full"));

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.error).toBe(true);
    });
  });

  describe("Storage service integration", () => {
    it("calls storeAvatar with user-specific userId", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      expect(storeAvatar).toHaveBeenCalledWith(
        expect.any(Buffer),
        mockUser.userId,
        expect.any(String),
      );
    });

    it("returns the URL from storeAvatar in the response", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const customUrl = "/uploads/avatars/999/123456_xyz.webp";
      (storeAvatar as jest.Mock).mockResolvedValue({
        url: customUrl,
        filePath: "/app/public/uploads/avatars/999/123456_xyz.webp",
      });

      const file = new File(["data"], "avatar.webp", { type: "image/webp" });
      const formData = new FormData();
      formData.append("file", file);

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      const data = await response.json();
      expect(data.avatarUrl).toBe(customUrl);
    });

    it("stores file and dataUrl uploads with distinct paths", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("img"),
        mimeType: "image/png",
      });

      const fileUrl = mockStored.url;
      const dataUrlResponse = "/uploads/avatars/123/1700000001_def456.png";
      (storeAvatar as jest.Mock)
        .mockResolvedValueOnce({ url: fileUrl, filePath: "..." })
        .mockResolvedValueOnce({ url: dataUrlResponse, filePath: "..." });

      const file = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const fileResp = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));
      const fileData = await fileResp.json();

      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const duResp = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      }));
      const duData = await duResp.json();

      expect(fileData.avatarUrl).toBe(fileUrl);
      expect(duData.avatarUrl).toBe(dataUrlResponse);
      expect(storeAvatar).toHaveBeenCalledTimes(2);
      expect(storeAvatar).toHaveBeenNthCalledWith(1, expect.any(Buffer), 123, "image/jpeg");
      expect(storeAvatar).toHaveBeenNthCalledWith(2, expect.any(Buffer), 123, "image/png");
    });
  });

  describe("Logger calls", () => {
    it("logs on file upload", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      const { logger } = require("@/lib/logger");
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 123, mimeType: "image/jpeg" }),
        "Avatar uploaded via file",
      );
    });

    it("logs on data URL upload", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("data"),
        mimeType: "image/png",
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "data:image/png;base64,abc" }),
      }));

      const { logger } = require("@/lib/logger");
      expect(logger.info).toHaveBeenCalledWith(
        { userId: 123 },
        "Avatar uploaded via data URL",
      );
    });

    it("logs on HTTP URL upload", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: true });
      (fetchAndValidateAvatarUrl as jest.Mock).mockResolvedValue({
        valid: true,
        fetched: {
          buffer: Buffer.from("data"),
          mimeType: "image/jpeg",
          originalUrl: "https://example.com/avatar.jpg",
        },
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/avatar.jpg" }),
      }));

      const { logger } = require("@/lib/logger");
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 123 }),
        "Avatar uploaded via HTTP URL with server-side fetch",
      );
    });
  });

  describe("Edge cases", () => {
    it("handles missing content-type header", async () => {
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: {} as any,
        body: "test",
      });

      const response = await POST(request);
      expect(response.status).toBe(415);
    });

    it("handles malformed JSON body", async () => {
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.error).toBe(true);
    });

    it("handles null body gracefully", async () => {
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: null as any,
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.error).toBe(true);
    });
  });

  describe("Response structure", () => {
    it("returns success true on successful upload", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        body: formData,
      }));

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toBeDefined();
      expect(data.message).toBe("Avatar uploaded successfully");
    });

    it("returns 200 with correct schema for dataUrl upload", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("img"),
        mimeType: "image/webp",
      });

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "data:image/webp;base64,UklGRhoA" }),
      }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("avatarUrl");
      expect(data).toHaveProperty("message");
    });
  });

  describe("HTTP URL validation integration", () => {
    beforeEach(() => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: true });
    });

    it("validates URL before storing", async () => {
      const url = "https://avatars.example.com/user.jpg";
      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }));

      expect(validateHttpAvatarUrl).toHaveBeenCalledWith(url);
    });

    it("does not call validateHttpAvatarUrl for dataUrl requests", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("img"),
        mimeType: "image/png",
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "data:image/png;base64,abc" }),
      }));

      expect(validateHttpAvatarUrl).not.toHaveBeenCalled();
    });

    it("does not call validateHttpAvatarUrl when only dataUrl is present even if url is empty", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });
      (parseDataUrl as jest.Mock).mockReturnValue({
        buffer: Buffer.from("img"),
        mimeType: "image/png",
      });

      await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl: "data:image/png;base64,abc", url: "" }),
      }));

      expect(validateHttpAvatarUrl).not.toHaveBeenCalled();
    });

    it("passes through mockResolvedValue behavior for async validation", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: false, error: "Blocked" });

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
      }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("Blocked");
    });

    it("rejects when url validation returns false (async flow)", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: false, error: "Invalid URL" });

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "invalid" }),
      }));

      expect(response.status).toBe(400);
      expect(storeAvatar).not.toHaveBeenCalled();
    });

    it("stores the fetched content and returns local URL", async () => {
      const testUrl = "https://cdn.example.com/avatars/img.jpg";
      (validateHttpAvatarUrl as jest.Mock).mockResolvedValue({ valid: true });
      (fetchAndValidateAvatarUrl as jest.Mock).mockResolvedValue({
        valid: true,
        fetched: {
          buffer: Buffer.from("img"),
          mimeType: "image/jpeg",
          originalUrl: testUrl,
        },
      });

      const response = await POST(new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      }));

      const data = await response.json();
      expect(data.avatarUrl).toBe(mockStored.url);
      expect(data.avatarUrl).not.toBe(testUrl);
    });
  });
});
