import { GeminiService } from "../geminiService";

// Mock the entire @google/generative-ai module
const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      };
    }),
  };
});

describe("GeminiService Error Handling", () => {
  let service: GeminiService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
    service = new GeminiService();
  });

  describe("Centralized Error Handling & Quota / Rate-limit Detection", () => {
    const errorScenarios = [
      {
        errorObj: new Error("Resource has exhausted quota"),
        expectedThrow: "Gemini API quota exceeded. Please try again later.",
        description: "quota string",
      },
      {
        errorObj: new Error("rate limit exceeded"),
        expectedThrow: "Gemini API quota exceeded. Please try again later.",
        description: "rate limit string",
      },
      {
        errorObj: new Error("API call failed with status 429"),
        expectedThrow: "Gemini API quota exceeded. Please try again later.",
        description: "429 string",
      },
      {
        errorObj: new Error("Something else failed"),
        expectedThrow: "AI analysis failed: Something else failed",
        description: "generic error object",
      },
      {
        errorObj: new Error("400 bad request: input too long"),
        expectedThrow:
          "Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.",
        description: "400 bad request string",
      },
      {
        errorObj: new Error("token limit exceeded"),
        expectedThrow:
          "Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.",
        description: "token limit string",
      },
      {
        errorObj: new Error("maximum context length exceeded"),
        expectedThrow:
          "Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.",
        description: "maximum context length string",
      },
      {
        errorObj: new Error("request body too large"),
        expectedThrow:
          "Repository or payload is too large for AI analysis context limit. Please try again with a smaller scope.",
        description: "too large string",
      },
      {
        errorObj: Object.assign(new Error("Bad Request"), { status: 400 }),
        expectedThrow: "AI analysis failed: Bad Request",
        description: "error with status 400",
      },
      {
        errorObj: "Just a string error",
        expectedThrow: "AI analysis failed: Unknown Gemini API error",
        description: "string error (non-Error object)",
      },
      {
        errorObj: null,
        expectedThrow: "AI analysis failed: Unknown Gemini API error",
        description: "null error (non-Error object)",
      },
    ];

    errorScenarios.forEach(({ errorObj, expectedThrow, description }) => {
      it(`should handle ${description} correctly in analyzeRepository`, async () => {
        mockGenerateContent.mockRejectedValueOnce(errorObj);

        await expect(
          service.analyzeRepository({
            repositoryId: 1,
            type: "overview",
          })
        ).rejects.toThrow(expectedThrow);
      });

      it(`should handle ${description} correctly in analyzeCode`, async () => {
        mockGenerateContent.mockRejectedValueOnce(errorObj);

        await expect(
          service.analyzeCode({
            code: "const x = 1;",
            language: "javascript",
            analysisType: "explain",
          })
        ).rejects.toThrow(expectedThrow);
      });
    });

    it("should handle custom error and log format for chatAboutRepository", async () => {
      const errorObj = new Error("Chat failed unexpectedly");
      mockGenerateContent.mockRejectedValueOnce(errorObj);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        service.chatAboutRepository({
          repositoryId: 1,
          question: "How does it work?",
        })
      ).rejects.toThrow("AI chat failed: Chat failed unexpectedly");

      expect(consoleSpy).toHaveBeenCalledWith("Gemini chat error:", errorObj);
      consoleSpy.mockRestore();
    });

    it("should handle custom error and log format for chatRaw", async () => {
      const errorObj = new Error("ChatRaw failed");
      mockGenerateContent.mockRejectedValueOnce(errorObj);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(service.chatRaw("Hello")).rejects.toThrow(
        "AI chat failed: ChatRaw failed"
      );

      expect(consoleSpy).toHaveBeenCalledWith("Gemini chat error:", errorObj);
      consoleSpy.mockRestore();
    });

    it("should handle custom error and log format for suggestCommitMessage", async () => {
      const errorObj = new Error("Commit suggestion failed");
      mockGenerateContent.mockRejectedValueOnce(errorObj);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        service.suggestCommitMessage({
          added: ["file.txt"],
          modified: [],
          deleted: [],
        })
      ).rejects.toThrow("Commit message suggestion failed: Commit suggestion failed");

      expect(consoleSpy).toHaveBeenCalledWith("Commit message suggestion error:", errorObj);
      consoleSpy.mockRestore();
    });
  });
});
