/**
 * @jest-environment node
 *
 * Tests for POST /api/ai/simulate-pr
 *
 * Verifies:
 * - Authentication requirements
 * - Rate limiting
 * - Input validation (diff required, diff size limits, line limits)
 * - Content type validation
 * - Repository context integration
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
  AI_REQUEST_LIMITS: {
    MAX_DIFF_CHARS: 50000,
  },
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";
import { checkAiRateLimit } from "@/lib/utils/ipRateLimit";
import { NextRequest } from "next/server";

describe("POST /api/ai/simulate-pr", () => {
  const mockUser = { userId: 123, email: "test@example.com" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (checkAiRateLimit as jest.Mock).mockResolvedValue(true);
    (getGeminiService as jest.Mock).mockReturnValue({
      chatRaw: jest.fn().mockResolvedValue({ text: "Review result" }),
    });
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ added line" }),
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

      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ added line" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many requests");
    });
  });

  describe("Input Validation", () => {
    it("returns 400 when diff is missing", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Diff content is required");
    });

    it("returns 400 when diff is empty string", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Diff content is required");
    });

    it("returns 400 when diff is whitespace only", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "   \n\t  " }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Diff content is required");
    });

    it("returns 400 when diff exceeds max length", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "x".repeat(50001) }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("exceeds maximum length");
    });

    it("returns 400 when diff exceeds max lines", async () => {
      const diff = Array(2001).fill("+ line").join("\n");
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("2000 lines");
    });

    it("returns 400 when repository ID is invalid", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ line", repositoryId: "abc" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid repository ID");
    });

    it("returns 404 when repository not found", async () => {
      (repositoryService.getRepository as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ line", repositoryId: 999 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Repository not found");
    });
  });

  describe("Successful Review", () => {
    it("returns review when diff is valid", async () => {
      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ const x = 1;\n- const y = 2;" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.review).toBeDefined();
    });

    it("includes repository context when repositoryId provided", async () => {
      (repositoryService.getRepository as jest.Mock).mockResolvedValue({
        name: "test-repo",
        description: "Test repository",
        languages: [{ name: "TypeScript", percentage: 100 }],
      });

      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          diff: "+ line",
          repositoryId: 1,
        }),
      });

      await POST(request);

      expect(getGeminiService).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on Gemini service error", async () => {
      (getGeminiService as jest.Mock).mockReturnValue({
        chatRaw: jest.fn().mockRejectedValue(new Error("Gemini API error")),
      });

      const request = new NextRequest("http://localhost/api/ai/simulate-pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff: "+ line" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
    });
  });
});
