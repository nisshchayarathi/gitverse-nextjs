/**
 * @jest-environment node
 *
 * Tests for PUT /api/users/profile
 *
 * These tests verify the profile update endpoint handles:
 * - Authentication requirements
 * - Password verification for email changes (security fix for #1554)
 * - Google account unlinking protection
 * - Rate limiting
 * - Input validation
 * - Session invalidation on email change
 * - Audit logging
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    account: {
      deleteMany: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/rateLimitService", () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  recordAttempt: jest.fn(),
  clearFailedAttempts: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { PUT } from "../route";
import { requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { isRateLimited, recordAttempt, clearFailedAttempts } from "@/lib/services/rateLimitService";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

describe("PUT /api/users/profile", () => {
  const mockUser = { userId: 123, email: "test@example.com" };

  const mockCurrentPasswordUser = {
    email: "current@example.com",
    passwordHash: "$2a$10$hashedpassword",
    accounts: [],
  };

  const mockGoogleOnlyUser = {
    email: "google@example.com",
    passwordHash: null,
    accounts: [{ provider: "google" }],
  };

  const mockHybridUser = {
    email: "hybrid@example.com",
    passwordHash: "$2a$10$hashedpassword",
    accounts: [{ provider: "google" }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockCurrentPasswordUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 123,
      name: "Test User",
      email: "test@example.com",
      image: null,
      createdAt: new Date(),
    });
    (prisma.account.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue("$2a$10$newhashedpassword");
  });

  describe("Authentication", () => {
    it("returns 500 when user is not authenticated (error caught in handler)", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update profile");
    });
  });

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      (isRateLimited as jest.Mock).mockResolvedValueOnce(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many profile update attempts");
    });
  });

  describe("Input Validation", () => {
    it("returns 400 when name is missing", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name and email are required");
    });

    it("returns 400 when email is missing", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name and email are required");
    });

    it("returns 400 when name is empty string", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "", email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name and email are required");
    });

    it("returns 400 when name is only whitespace", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "   ", email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be a non-empty string");
    });

    it("returns 400 when name exceeds 100 characters", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "a".repeat(101), email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be less than 100 characters");
    });

    it("returns 400 when email is invalid format", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "invalidemail" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    it("returns 400 when email exceeds 254 characters", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "a".repeat(255) + "@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email must be less than 254 characters");
    });

    it("returns 400 when request body is invalid JSON", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "invalid json",
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid or empty request body");
    });
  });

  describe("Password Validation", () => {
    it("returns 400 when newPassword is less than 8 characters", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "test@example.com",
          newPassword: "short",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Password must be at least 8 characters");
    });

    it("returns 400 when newPassword exceeds 128 characters", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "test@example.com",
          newPassword: "a".repeat(129),
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Password must be less than 128 characters");
    });

    it("returns 400 when newPassword is not a string", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "test@example.com",
          newPassword: 12345678,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("New password must be a string");
    });
  });

  describe("Email Uniqueness", () => {
    it("returns 400 when email is already in use", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 999,
        email: "taken@example.com",
      });

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "taken@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email is already in use");
    });
  });

  describe("Security: Email Change with Password Verification (#1554)", () => {
    it("requires current password when changing email for password-based user", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Current password is required");
    });

    it("returns 401 when current password is incorrect", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "wrongpassword",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Current password is incorrect");
    });

    it("records failed attempt when password verification fails", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "wrongpassword",
        }),
      });

      await PUT(request);

      expect(recordAttempt).toHaveBeenCalledWith({
        key: "123",
        type: "CHANGE_PASSWORD",
        success: false,
        userId: 123,
      });
    });

    it("clears failed attempts when password is correct", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "correctpassword",
        }),
      });

      await PUT(request);

      expect(clearFailedAttempts).toHaveBeenCalledWith("123", "CHANGE_PASSWORD");
    });

    it("allows email change with correct current password", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "correctpassword",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe("Security: Google Account Unlinking Protection (#1554)", () => {
    it("blocks Google-only user from changing email without re-auth", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockGoogleOnlyUser,
        email: "old@example.com",
      });

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          newPassword: "newpassword123",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("REAUTH_REQUIRED");
      expect(data.error).toContain("re-authenticate with Google");
    });

    it("returns 400 when Google-only user tries to change email without newPassword", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockGoogleOnlyUser,
        email: "old@example.com",
      });

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("provide a new password");
    });

    it("requires newPassword for Google user with password when changing email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockHybridUser,
        email: "old@example.com",
      });

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "currentpassword",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("provide a new password");
    });

    it("unlinks Google and sets new password for hybrid user with correct credentials", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockHybridUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "currentpassword",
          newPassword: "newpassword123",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.account.deleteMany).toHaveBeenCalledWith({
        where: { userId: 123, provider: "google" },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 123 },
      });
      expect(data.message).toContain("Google account has been unlinked");
    });
  });

  describe("Session Invalidation", () => {
    it("invalidates all sessions when Google account is unlinked", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockHybridUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "currentpassword",
          newPassword: "newpassword123",
        }),
      });

      await PUT(request);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 123 },
      });
    });

    it("does not invalidate sessions when only name changes", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          email: "current@example.com",
        }),
      });

      await PUT(request);

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("Audit Logging", () => {
    it("creates audit log when email is changed", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockCurrentPasswordUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "correctpassword",
        }),
      });

      await PUT(request);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 123,
          action: "EMAIL_CHANGED",
          resource: "USER",
          details: expect.objectContaining({
            previousEmail: "old@example.com",
            newEmail: "new@example.com",
          }),
        }),
      });
    });

    it("does not create audit log when email is not changed", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          email: "current@example.com",
        }),
      });

      await PUT(request);

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("Avatar Validation", () => {
    it("accepts valid HTTP avatar URL", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: "https://example.com/avatar.jpg",
        }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });

    it("accepts valid data URL avatar", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });

    it("rejects invalid avatar URL", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: "ftp://invalid.com/avatar.jpg",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Avatar must be a valid");
    });

    it("rejects non-string avatar", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: 12345,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Avatar must be a valid image URL");
    });

    it("rejects avatar with unsupported file extension", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: "https://example.com/avatar.bmp",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Avatar must be a valid");
    });

    it("rejects data URL with non-image MIME type", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "current@example.com",
          avatar: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Avatar must be a valid");
    });
  });

  describe("Successful Updates", () => {
    it("updates profile with name only", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          email: "current@example.com",
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Test User");
      expect(data.message).toBe("Profile updated successfully");
    });

    it("trims whitespace from name", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "  Trimmed Name  ",
          email: "current@example.com",
        }),
      });

      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Trimmed Name",
          }),
        })
      );
    });

    it("normalizes email to lowercase", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "CURRENT@EXAMPLE.COM",
        }),
      });

      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "current@example.com",
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("returns 404 when user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "test@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("returns 500 on database error", async () => {
      (prisma.user.update as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "current@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update profile");
    });

    it("returns 404 when user is deleted during update", async () => {
      (prisma.user.update as jest.Mock).mockRejectedValue(
        Object.assign(new Error("Record not found"), { code: "P2025" })
      );

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "current@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Token Version Increment", () => {
    it("increments token version when Google account is unlinked", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockHybridUser,
        email: "old@example.com",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          email: "new@example.com",
          currentPassword: "currentpassword",
          newPassword: "newpassword123",
        }),
      });

      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        })
      );
    });

    it("does not increment token version when only name changes", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          email: "current@example.com",
        }),
      });

      await PUT(request);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            tokenVersion: expect.anything(),
          }),
        })
      );
    });
  });

  describe("Response Format", () => {
    it("returns user data without password hash", async () => {
      const request = new NextRequest("http://localhost/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "current@example.com" }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(data).not.toHaveProperty("passwordHash");
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("email");
      expect(data).toHaveProperty("avatarUrl");
    });
  });
});
