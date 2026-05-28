import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("@/lib/middleware", () => {
  return {
    requireAuth: jest.fn().mockResolvedValue({
      userId: 1,
      email: "test@example.com",
    }),
  };
});

jest.mock("@/lib/services/geminiService", () => ({
  getGeminiService: jest.fn(() => ({
    chatRaw: jest.fn(),
    chatAboutRepository: jest.fn(),
  })),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn(),
  },
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function parseJsonResponse(response: Response) {
  return response.json() as Promise<{ error?: string; details?: string; stack?: string }>;
}

describe("POST /api/ai/chat — validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when repositoryId or question is missing", async () => {
    const response = await POST(createRequest({ question: "hello" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("repositoryId and question are required");
  });

  it("returns 400 when conversationHistory is not an array", async () => {
    const response = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: "not-an-array",
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("conversationHistory must be an array");
  });

  it("returns 400 when a message is missing role", async () => {
    const response = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: [{ content: "Hello" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string"
    );
  });

  it("returns 400 when a message is missing content", async () => {
    const response = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: [{ role: "user" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string"
    );
  });

  it("returns 400 when role or content is empty whitespace", async () => {
    const emptyRole = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: [{ role: "   ", content: "Hello" }],
      })
    );
    const emptyContent = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: [{ role: "user", content: "   " }],
      })
    );

    expect(emptyRole.status).toBe(400);
    expect(emptyContent.status).toBe(400);
    expect((await parseJsonResponse(emptyRole)).error).toBe(
      "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string"
    );
    expect((await parseJsonResponse(emptyContent)).error).toBe(
      "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string"
    );
  });

  it("returns 400 when a message entry is not a valid object", async () => {
    const response = await POST(
      createRequest({
        repositoryId: "1",
        question: "hello",
        conversationHistory: [null],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Each conversationHistory entry must have role ('user' or 'model') and a non-empty content string"
    );
  });
});
