process.env.JWT_SECRET = "test-secret-key-12345";
process.env.GEMINI_API_KEY = "test-gemini-api-key";

import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/middleware", () => {
  return {
    requireAuth: jest.fn().mockResolvedValue({
      userId: 1,
      email: "test@example.com",
    }),
    isHttpError: jest.fn().mockReturnValue(false),
    sanitizeError: jest.fn().mockImplementation((e) => e),
  };
});

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn().mockResolvedValue({
      id: 1,
      url: "https://github.com/test-owner/test-repo",
      files: [{ path: "src/components/layout/DashboardLayout.tsx" }],
    }),
  },
}));

jest.mock("@/lib/services/githubService", () => {
  const mockGetIssues = jest.fn().mockResolvedValue([
    {
      number: 101,
      title: "Fix responsive design in dashboard layout",
      html_url: "https://github.com/test-owner/test-repo/issues/101",
      body: "The layout sidebar breaks on mobile viewports. We need to hide it and add a toggle button.",
      labels: [{ name: "good first issue" }],
    },
  ]);
  const mockParseGitHubUrl = jest.fn().mockReturnValue({
    owner: "test-owner",
    repo: "test-repo",
  });

  return {
    GitHubService: jest.fn().mockImplementation(() => ({
      getIssues: mockGetIssues,
    })),
  };
});

// Since the mock above defines standard class exports, we mock parseGitHubUrl static method
import { GitHubService } from "@/lib/services/githubService";
(GitHubService as any).parseGitHubUrl = jest.fn().mockReturnValue({
  owner: "test-owner",
  repo: "test-repo",
});

jest.mock("@/lib/services/geminiService", () => ({
  getGeminiService: jest.fn(() => ({
    chatRaw: jest.fn().mockResolvedValue(
      JSON.stringify({
        matches: [
          {
            number: 101,
            score: 95,
            matchedFiles: ["src/components/layout/DashboardLayout.tsx"],
            reason: "This modifies layout structure which is managed in DashboardLayout.tsx.",
          },
        ],
      })
    ),
  })),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    gitHubAccount: {
      findUnique: jest.fn().mockResolvedValue({
        accessToken: "test-access-token",
      }),
    },
  },
}));

function createRequest(skills = ""): NextRequest {
  return new NextRequest(`http://localhost/api/repositories/1/issues?skills=${skills}`, {
    method: "GET",
  });
}

describe("GET /api/repositories/[id]/issues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("successfully fetches issues and maps them using Gemini", async () => {
    const response = await GET(createRequest("TypeScript"), { params: { id: "1" } });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.issues).toBeDefined();
    expect(data.issues.length).toBe(1);

    const firstIssue = data.issues[0];
    expect(firstIssue.number).toBe(101);
    expect(firstIssue.score).toBe(95);
    expect(firstIssue.matchedFiles).toContain("src/components/layout/DashboardLayout.tsx");
    expect(firstIssue.reason).toBe("This modifies layout structure which is managed in DashboardLayout.tsx.");
  });

  it("handles non-numeric ID parameter gracefully", async () => {
    const response = await GET(createRequest(""), { params: { id: "abc" } });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invalid repository ID");
  });
});
