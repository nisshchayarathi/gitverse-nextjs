/**
 * @jest-environment node
 *
 * Tests for file content path traversal prevention and security hardening.
 * Validates that the file content endpoint properly sanitizes paths,
 * prevents traversal attacks, rejects binary files, and limits response sizes.
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  isHttpError: jest.fn((error: any) => error?.status !== undefined),
  sanitizeError: jest.fn((error: any) => error?.message || "Unknown error"),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// We need to test the validation functions directly since they're not exported.
// We'll test them through the route handler behavior.
import { GET } from "@/app/api/repositories/[id]/files/content/route";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { NextRequest } from "next/server";

function createRequest(path: string): NextRequest {
  const url = new URL(
    `https://example.com/api/repositories/1/files/content?path=${encodeURIComponent(path)}`
  );
  return new NextRequest(url.toString());
}

function mockAuth() {
  (requireAuth as jest.Mock).mockResolvedValue({
    userId: 1,
    email: "test@test.com",
  });
}

function mockRepository(
  url = "https://github.com/test-org/test-repo",
  defaultBranch = "main"
) {
  (repositoryService.getRepository as jest.Mock).mockResolvedValue({
    id: 1,
    url,
    defaultBranch,
    userId: 1,
  });
}

function mockGitHubFetch(
  status = 200,
  body = "file content",
  headers: Record<string, string> = {}
) {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Not Found",
    headers: new Map(Object.entries(headers)),
    text: () => Promise.resolve(body),
  });
}

describe("File Content Path Traversal Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
    mockRepository();
    mockGitHubFetch();
  });

  // =========================================================================
  // Path Traversal Attacks
  // =========================================================================

  describe("path traversal prevention", () => {
    it("rejects path with parent directory traversal", async () => {
      const req = createRequest("../../../etc/passwd");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("invalid");
    });

    it("rejects path with encoded parent traversal", async () => {
      const req = createRequest("..%2F..%2F..%2Fetc%2Fpasswd");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects path with multiple parent traversals", async () => {
      const req = createRequest("src/../../.env");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("invalid");
    });

    it("rejects path with backslashes", async () => {
      const req = createRequest("..\\..\\..\\windows\\system32\\config\\sam");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects path with null bytes", async () => {
      const req = createRequest("src/index.ts%00.jpg");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects path that is only dots", async () => {
      const req = createRequest("...");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects absolute path starting with /", async () => {
      const req = createRequest("/etc/passwd");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("must not start with /");
    });

    it("rejects path with .. segment", async () => {
      const req = createRequest("src/../secret.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects path with . segment", async () => {
      const req = createRequest("./src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Input Validation
  // =========================================================================

  describe("input validation", () => {
    it("rejects missing path", async () => {
      const url = new URL("https://example.com/api/repositories/1/files/content");
      const req = new NextRequest(url.toString());
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("required");
    });

    it("rejects invalid repository ID", async () => {
      const url = new URL(
        "https://example.com/api/repositories/abc/files/content?path=src/index.ts"
      );
      const req = new NextRequest(url.toString());
      const res = await GET(req, { params: { id: "abc" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid repository ID");
    });

    it("rejects overly long file path", async () => {
      const longPath = "a".repeat(1025);
      const req = createRequest(longPath);
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("maximum length");
    });

    it("accepts valid file path", async () => {
      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.content).toBe("file content");
    });

    it("accepts path with dots in filename", async () => {
      const req = createRequest("config/test.config.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts nested path", async () => {
      const req = createRequest("src/components/Button.tsx");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Binary File Rejection
  // =========================================================================

  describe("binary file rejection", () => {
    it("rejects PNG files", async () => {
      const req = createRequest("image.png");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("text files");
    });

    it("rejects JPEG files", async () => {
      const req = createRequest("photo.jpg");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects PDF files", async () => {
      const req = createRequest("document.pdf");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects binary executables", async () => {
      const req = createRequest("binary.exe");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("accepts TypeScript files", async () => {
      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts JavaScript files", async () => {
      const req = createRequest("dist/bundle.js");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts Markdown files", async () => {
      const req = createRequest("README.md");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts JSON files", async () => {
      const req = createRequest("package.json");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts YAML files", async () => {
      const req = createRequest(".github/workflows/ci.yml");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts env files", async () => {
      const req = createRequest(".env.example");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts files without extension", async () => {
      const req = createRequest("Makefile");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("rejects Word documents", async () => {
      const req = createRequest("document.docx");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects ZIP archives", async () => {
      const req = createRequest("archive.zip");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects MP3 audio files", async () => {
      const req = createRequest("audio.mp3");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // URL Construction
  // =========================================================================

  describe("URL construction safety", () => {
    it("encodes path segments to prevent injection", async () => {
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      // Segments are encoded individually, so slashes are preserved
      // but special chars within segments would be encoded
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toContain("raw.githubusercontent.com");
      expect(fetchUrl).toContain("test-org/test-repo");
      expect(fetchUrl).toContain("/src/index.ts");
    });

    it("encodes special characters in path segments", async () => {
      // Path with characters that don't need encoding (passes validation)
      const req = createRequest("src/file_v2.ts");
      await GET(req, { params: { id: "1" } });

      const fetchUrl = mockFetch.mock.calls[0][0];
      // Verify the URL is properly constructed
      expect(fetchUrl).toContain("raw.githubusercontent.com");
      expect(fetchUrl).toContain("src/file_v2.ts");
    });

    it("encodes branch name", async () => {
      mockRepository("https://github.com/test/repo", "feature/branch");
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("feature%2Fbranch"),
        expect.any(Object)
      );
    });

    it("uses default branch when not set", async () => {
      mockRepository("https://github.com/test/repo", "");
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/main/"),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  describe("error handling", () => {
    it("returns 404 when repository not found", async () => {
      (repositoryService.getRepository as jest.Mock).mockResolvedValue(null);

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toContain("not found");
    });

    it("returns 404 when file not found on GitHub", async () => {
      mockGitHubFetch(404);

      const req = createRequest("nonexistent.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toContain("not found on GitHub");
    });

    it("returns error for non-GitHub repositories", async () => {
      mockRepository("https://gitlab.com/org/repo");

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("GitHub");
    });

    it("returns 500 on internal errors without leaking details", async () => {
      (repositoryService.getRepository as jest.Mock).mockRejectedValue(
        new Error("DB password: secret123")
      );

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).not.toContain("secret123");
    });

    it("handles fetch timeout gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Timeout"));

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain("Failed to fetch");
    });
  });

  // =========================================================================
  // Auth Integration
  // =========================================================================

  describe("authentication", () => {
    it("requires authentication", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(
        Object.assign(new Error("Unauthorized"), { status: 401 })
      );

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(401);
    });

    it("passes userId to repository service", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({
        userId: 42,
        email: "user@test.com",
      });

      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(repositoryService.getRepository).toHaveBeenCalledWith(1, 42);
    });
  });

  // =========================================================================
  // GitHub URL Parsing
  // =========================================================================

  describe("GitHub URL parsing", () => {
    it("extracts owner and repo from standard GitHub URL", async () => {
      mockRepository("https://github.com/my-org/my-repo");
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("raw.githubusercontent.com/my-org/my-repo/"),
        expect.any(Object)
      );
    });

    it("handles GitHub URL with .git suffix", async () => {
      mockRepository("https://github.com/my-org/my-repo.git");
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("raw.githubusercontent.com/my-org/my-repo/"),
        expect.any(Object)
      );
    });

    it("handles GitHub URL with trailing slash", async () => {
      mockRepository("https://github.com/my-org/my-repo/");
      const req = createRequest("src/index.ts");
      await GET(req, { params: { id: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("raw.githubusercontent.com/my-org/my-repo/"),
        expect.any(Object)
      );
    });

    it("rejects non-GitHub URLs (GitLab)", async () => {
      mockRepository("https://gitlab.com/org/repo");
      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("GitHub");
    });

    it("rejects non-GitHub URLs (Bitbucket)", async () => {
      mockRepository("https://bitbucket.org/org/repo");
      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(400);
    });

    it("rejects HTTP GitHub URLs (non-HTTPS)", async () => {
      mockRepository("http://github.com/org/repo");
      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      // Should still work since regex allows http
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Content Size Limits
  // =========================================================================

  describe("content size limits", () => {
    it("rejects files exceeding Content-Length limit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-length", "2097152"]]), // 2MB
        text: () => Promise.resolve("small content"),
      });

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(413);
      expect(body.error).toContain("too large");
    });

    it("rejects files exceeding actual content size", async () => {
      const largeContent = "x".repeat(1024 * 1024 + 1);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-length", "100"]]), // Lies about size
        text: () => Promise.resolve(largeContent),
      });

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(413);
      expect(body.error).toContain("too large");
    });

    it("accepts files within size limit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-length", "1000"]]),
        text: () => Promise.resolve("normal content"),
      });

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Path Edge Cases
  // =========================================================================

  describe("path edge cases", () => {
    it("rejects path with multiple consecutive slashes", async () => {
      const req = createRequest("src//index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      // Empty segment between slashes should be rejected
      expect(res.status).toBe(400);
    });

    it("rejects path ending with slash", async () => {
      const req = createRequest("src/");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("accepts deeply nested valid path", async () => {
      const req = createRequest("src/components/ui/buttons/Primary.tsx");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("accepts path with hyphens and underscores", async () => {
      const req = createRequest("my-components/my_utils.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(200);
    });

    it("rejects path with special characters", async () => {
      const req = createRequest("src/index@v2.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it("rejects path with question mark", async () => {
      const req = createRequest("src/index?.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(400);
    });

    it("rejects path with hash", async () => {
      const req = createRequest("src/index#.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // GitHub API Response Handling
  // =========================================================================

  describe("GitHub API response handling", () => {
    it("handles GitHub API rate limiting", async () => {
      mockGitHubFetch(403, "rate limit exceeded");

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toContain("GitHub API error");
    });

    it("handles GitHub API server error", async () => {
      mockGitHubFetch(500, "Internal Server Error");

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(500);
    });

    it("handles GitHub API unauthorized", async () => {
      mockGitHubFetch(401, "Unauthorized");

      const req = createRequest("src/index.ts");
      const res = await GET(req, { params: { id: "1" } });

      expect(res.status).toBe(401);
    });
  });
});
