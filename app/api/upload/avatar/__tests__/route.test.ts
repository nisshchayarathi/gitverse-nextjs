/**
 * Tests for POST /api/upload/avatar
 *
 * These tests verify the avatar upload endpoint handles:
 * - Authentication requirements
 * - File validation (type, size)
 * - Data URL validation
 * - HTTP URL validation
 * - Content-Type handling
 * - Error response formatting
 */

// Mock dependencies
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
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/middleware";
import {
  validateImageFile,
  validateDataUrl,
  validateHttpAvatarUrl,
} from "@/lib/services/imageService";
import { NextRequest } from "next/server";

describe("POST /api/upload/avatar", () => {
  const mockUser = { userId: 123, email: "test@example.com" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/avatar.jpg" }),
      });

      await expect(POST(request)).rejects.toThrow("Unauthorized");
    });
  });

  describe("Content-Type handling", () => {
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
        headers: { "content-type": "multipart/form-data" },
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

      const file = new File(["test"], "document.pdf", {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "multipart/form-data" },
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
      const file = new File([largeContent], "large.jpg", {
        type: "image/jpeg",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "multipart/form-data" },
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.message).toContain("File too large");
    });

    it("returns 200 for valid file upload", async () => {
      (validateImageFile as jest.Mock).mockReturnValue({ valid: true });

      const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "multipart/form-data" },
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe("Data URL upload", () => {
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

    it("returns 200 for valid data URL", async () => {
      (validateDataUrl as jest.Mock).mockReturnValue({ valid: true });

      const dataUrl =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAA";
      const request = new NextRequest("http://localhost/api/upload/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toBe(dataUrl);
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

    it("returns 200 for valid HTTP URL", async () => {
      (validateHttpAvatarUrl as jest.Mock).mockReturnValue({ valid: true });

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
      expect(data.avatarUrl).toBe(url);
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
  });

  describe("Error response format", () => {
    it("returns consistent error format", async () => {
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
  });
});
