/**
 * @jest-environment node
 *
 * Tests for GeminiService Circuit Breaker
 */

import { GeminiService } from "../geminiService";
import CircuitBreaker from "opossum";

const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            generateContent: mockGenerateContent,
          };
        }),
      };
    }),
  };
});

jest.mock("../geminiAnalysisCacheService", () => ({
  getGeminiAnalysisCache: jest.fn().mockResolvedValue({ hit: false }),
  setGeminiAnalysisCache: jest.fn().mockResolvedValue(true),
}));

describe("GeminiService Circuit Breaker", () => {
  let service: GeminiService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeminiService("test-key");
  });

  describe("Successful Requests", () => {
    it("should return the successful response when model works", async () => {
      mockGenerateContent.mockResolvedValue({
        response: Promise.resolve({
          text: () => "Successful analysis content",
          usageMetadata: { totalTokenCount: 150 },
        }),
      });

      const result = await service.analyzeRepository({
        repositoryId: 1,
        type: "overview",
      });

      expect(result).toBe("Successful analysis content");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      
      const breaker = (service as any).breaker;
      expect(breaker.opened).toBe(false);
    });
  });

  describe("Fallback Behavior", () => {
    it("should return fallback response when model throws an error", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API rate limit exceeded or backend error"));

      const result = await service.analyzeRepository({
        repositoryId: 1,
        type: "overview",
      });

      expect(result).toBe("AI service temporarily unavailable due to safety limits.");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe("Timeout Behavior", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should timeout and trigger fallback when call takes longer than 15 seconds", async () => {
      // Mock generateContent to resolve after 20 seconds
      mockGenerateContent.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              response: Promise.resolve({
                text: () => "AI analysis result",
                usageMetadata: { totalTokenCount: 100 },
              }),
            });
          }, 20000);
        });
      });

      const promise = service.analyzeRepository({
        repositoryId: 1,
        type: "overview",
      });

      // Advance Jest timers to trigger the circuit breaker's 15s timeout
      jest.advanceTimersByTime(16000);
      
      // Let any pending promises resolve
      await Promise.resolve();
      await Promise.resolve();

      const result = await promise;
      expect(result).toBe("AI service temporarily unavailable due to safety limits.");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe("Circuit Tripping", () => {
    it("should trip open after 50% or more errors and fail fast", async () => {
      const breaker = (service as any).breaker;
      
      // Reset the breaker state to ensure it starts closed
      breaker.close();
      
      mockGenerateContent
        .mockResolvedValueOnce({
          response: Promise.resolve({
            text: () => "Success 1",
            usageMetadata: { totalTokenCount: 10 },
          }),
        })
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"));

      // Request 1: Success (Error rate: 0%)
      const r1 = await service.analyzeRepository({ repositoryId: 1, type: "overview" });
      expect(r1).toBe("Success 1");
      expect(breaker.opened).toBe(false);
      
      // Request 2: Fail (Error rate: 50%)
      const r2 = await service.analyzeRepository({ repositoryId: 1, type: "overview" });
      expect(r2).toBe("AI service temporarily unavailable due to safety limits.");
      expect(breaker.opened).toBe(false); // Exactly 50% doesn't trip it (requires > 50%)

      // Request 3: Fail (Error rate: 66.7%)
      const r3 = await service.analyzeRepository({ repositoryId: 1, type: "overview" });
      expect(r3).toBe("AI service temporarily unavailable due to safety limits.");

      // Check if breaker tripped open because we exceeded 50% error rate
      expect(breaker.opened).toBe(true);

      // Subsequent requests should fail fast/fallback without calling model
      mockGenerateContent.mockClear();
      
      const r4 = await service.analyzeRepository({ repositoryId: 1, type: "overview" });
      expect(r4).toBe("AI service temporarily unavailable due to safety limits.");
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });
});
