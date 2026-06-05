/**
 * @jest-environment node
 *
 * Tests for POST /api/ai/compare
 *
 * Verifies:
 * - Authentication requirements
 * - Rate limiting
 * - Input validation (array required, min 2 repos, max 5 repos, valid IDs)
 * - Repository ownership verification
 * - Error handling
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
  isHttpError: jest.fn((err) => err?.status !== undefined),
}));

jest.mock("@/lib/services/geminiService", () => ({
  getGeminiService: jest.fn(),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn(),
  },
}));

jest.mock("@/lib/utils/ipRateLimit", () => ({
  checkAiRateLimit: jest.fn(),
  logAiRequest: jest.fn(),
}));

jest.mock("@/lib/services/rateLimitService", () => ({
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("@/lib/utils/aiRequestValidation", () => ({
  validateContentType: jest.fn().mockReturnValue(null),
  AI_REQUEST_LIMITS: {},
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import { checkAiRateLimit } from "@/lib/utils/ipRateLimit";
import { NextRequest } from "next/server";

describe("POST /api/ai/compare", () => {
  const mockUser = { userId: 123, email: "test@example.com" };

  const mockRepo = {
    name: "test-repo",
    description: "Test",
    languages: [{ name: "TypeScript", percentage: 100 }],
    branches: [{ name: "main" }],
    commits: [],
    files: [],
    contributors: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (checkAiRateLimit as jest.Mock).mockResolvedValue(true);
    (getGeminiService as jest.Mock).mockReturnValue({
      chatRaw: jest.fn().mockResolvedValue({ text: "Comparison result" }),
    });
    (repositoryService.getRepository as jest.Mock).mockResolvedValue(mockRepo);
  });

  describe("Authentication", () => {
    it("returns 500 when user is not authenticated (error caught in handler)", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("returns 429 when rate limited", async () => {
      (checkAiRateLimit as jest.Mock).mockResolvedValue(false);

      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many requests");
    });
  });

  describe("Input Validation", () => {
    it("returns 400 when repositoryIds is missing", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("repositoryIds must be an array");
    });

    it("returns 400 when repositoryIds is not an array", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: "1,2" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("repositoryIds must be an array");
    });

    it("returns 400 when less than 2 repositories", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("At least two");
    });

    it("returns 400 when more than 5 repositories", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2, 3, 4, 5, 6] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Maximum 5");
    });

    it("returns 400 when repository ID is not a number", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: ["abc", 2] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid repository ID");
    });

    it("returns 404 when repository not found", async () => {
      (repositoryService.getRepository as jest.Mock)
        .mockResolvedValueOnce(mockRepo)
        .mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 999] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Repository not found");
    });
  });

  describe("Successful Comparison", () => {
    it("returns comparison when valid input", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comparison).toBeDefined();
    });

    it("accepts exactly 2 repositories", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("accepts exactly 5 repositories", async () => {
      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2, 3, 4, 5] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on Gemini service error", async () => {
      (getGeminiService as jest.Mock).mockReturnValue({
        chatRaw: jest.fn().mockRejectedValue(new Error("Gemini API error")),
      });

      const request = new NextRequest("http://localhost/api/ai/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryIds: [1, 2] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
    });
  });
});
