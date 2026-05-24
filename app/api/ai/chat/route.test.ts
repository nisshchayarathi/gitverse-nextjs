import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/middleware")>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({
      userId: 1,
      email: "test@example.com",
    }),
  };
});

vi.mock("@/lib/services/geminiService", () => ({
  getGeminiService: vi.fn(() => ({
    chatRaw: vi.fn(),
    chatAboutRepository: vi.fn(),
  })),
}));

vi.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: vi.fn(),
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

describe("POST /api/ai/chat — messages validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when messages is missing", async () => {
    const response = await POST(createRequest({ prompt: "hello" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("messages is required and must be an array");
    expect(data.stack).toBeUndefined();
  });

  it("returns 400 when messages is not an array", async () => {
    const response = await POST(createRequest({ messages: "not-an-array" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("messages is required and must be an array");
  });

  it("returns 400 when a message is missing role", async () => {
    const response = await POST(
      createRequest({
        messages: [{ content: "Hello" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Each message must include role and content");
    expect(data.stack).toBeUndefined();
  });

  it("returns 400 when a message is missing content", async () => {
    const response = await POST(
      createRequest({
        messages: [{ role: "user" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Each message must include role and content");
  });

  it("returns 400 when role or content is empty whitespace", async () => {
    const emptyRole = await POST(
      createRequest({
        messages: [{ role: "   ", content: "Hello" }],
      })
    );
    const emptyContent = await POST(
      createRequest({
        messages: [{ role: "user", content: "   " }],
      })
    );

    expect(emptyRole.status).toBe(400);
    expect(emptyContent.status).toBe(400);
    expect((await parseJsonResponse(emptyRole)).error).toBe(
      "Each message must include role and content"
    );
    expect((await parseJsonResponse(emptyContent)).error).toBe(
      "Each message must include role and content"
    );
  });

  it("returns 400 when a message entry is not a valid object", async () => {
    const response = await POST(
      createRequest({
        messages: [null],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe("Each message must include role and content");
  });
});
