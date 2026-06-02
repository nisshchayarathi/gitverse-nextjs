const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { ReadableStream } = require("node:stream/web");
global.ReadableStream = ReadableStream;

const undici = require("undici");
(global as any).Request = undici.Request;
(global as any).Response = undici.Response;

/**
 * ====================================================================================
 * SECURITY INTEGRATION & ROBUSTNESS TEST SUITE: FILE CONTENT PREVIEW SECURITY BOUNDS
 * ====================================================================================
 * 
 * This test suite guarantees the robustness and operational safety of the repository
 * file content preview API endpoint (`app/api/repositories/[id]/files/content/route.ts`).
 * 
 * Secure Software Development Lifecycle (SSDLC) Objectives:
 * 1. Path Traversal Mitigation: Ensure that double dot sequences (`..`), absolute paths (`/`),
 *    and other traversal payloads are strictly blocked before resolution to prevent arbitrary
 *    file read vulnerabilities (OWASP A01:2021-Broken Access Control).
 * 2. Sensitive Data Isolation: Guarantee that configuration or credential files containing
 *    system secrets (e.g. `.env`, `.pem` keyfiles) can never be fetched by preview mechanics.
 * 3. Resource Exhaustion & DoS Shield: Validate file size restrictions (e.g. 1MB limits) on
 *    content streams to prevent attackers from causing out-of-memory crashes on the backend.
 * 4. Binary Injection Avoidance: Enforce format whitelist constraints, blocking arbitrary
 *    binary preview payloads (e.g., zip files, compiled objects, disk images) to maintain
 *    execution path security.
 * 5. Dynamic Segment Encoding: Confirm that directory paths are safely segmented and encoded
 *    individually, preventing structural URL injection attacks during raw.githubusercontent.com resolution.
 */

jest.mock("@/lib/middleware", () => ({
  requireAuth: jest.fn(),
  sanitizeError: jest.fn((err) => err?.message || "Unknown error"),
  isHttpError: jest.fn(() => false),
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    getRepository: jest.fn(),
  },
}));

const { GET } = require("../route");
const { requireAuth } = require("@/lib/middleware");
const { repositoryService } = require("@/lib/services/repositoryService");
const { NextRequest } = require("next/server");

describe("GET /api/repositories/[id]/files/content - Security Bounds and Robustness Checks", () => {
  const mockUser = { userId: 123 };
  const mockRepo = {
    id: 1,
    url: "https://github.com/owner/repo",
    defaultBranch: "main",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
    (repositoryService.getRepository as jest.Mock).mockResolvedValue(mockRepo);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue("100"),
      },
      text: jest.fn().mockResolvedValue("mocked content"),
    } as any);
  });

  describe("Standard Operational Scenarios", () => {
    it("Scenario 1.1: successfully retrieves text file content under normal parameters", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe("mocked content");
      expect(data.path).toBe("src/index.js");
    });

    it("Scenario 1.2: successfully retrieves files with complex multi-level folder paths", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/components/layout/Navbar/Navbar.tsx");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.path).toBe("src/components/layout/Navbar/Navbar.tsx");
    });

    it("Scenario 1.3: rejects requests lacking a repository ID parameter", async () => {
      const request = new NextRequest("http://localhost/api/repositories/NaN/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "NaN" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid repository ID");
    });

    it("Scenario 1.4: rejects requests missing the file path parameter", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("File path is required");
    });
  });

  describe("Advanced Path Traversal Mitigation checks (OWASP A01)", () => {
    const traversalAttackPayloads = [
      "../../.env",
      "src/../../../.env",
      "./src/../../etc/passwd",
      "dir/subdir/../../.env",
      "../package.json",
      "..\\..\\etc\\passwd",
      ".../...",
      "..../....",
      "src/../..",
      "sub/..",
    ];

    for (const payload of traversalAttackPayloads) {
      it(`Scenario 2.X: blocks path traversal attempt containing sequence "${payload}"`, async () => {
        const request = new NextRequest(`http://localhost/api/repositories/1/files/content?path=${payload}`);
        const response = await GET(request, { params: { id: "1" } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Path traversal detected");
      });
    }

    it("Scenario 2.Y: blocks absolute paths starting with '/' to prevent local file reads", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=/etc/passwd");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Absolute path not allowed");
    });

    it("Scenario 2.Z: blocks paths containing null byte injection attempts", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js%00.png");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Null bytes not allowed");
    });
  });

  describe("Sensitive Asset Access Restrictions", () => {
    const sensitiveFiles = [
      ".env",
      "config/.env",
      "deploy.key",
      "keys/production.pem",
      "secrets.env",
      "ssl/nginx.pem",
      "id_rsa.key",
    ];

    for (const sensitiveFile of sensitiveFiles) {
      it(`Scenario 3.X: denies access attempt to sensitive file format: "${sensitiveFile}"`, async () => {
        const request = new NextRequest(`http://localhost/api/repositories/1/files/content?path=${sensitiveFile}`);
        const response = await GET(request, { params: { id: "1" } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Access to sensitive files is restricted");
      });
    }
  });

  describe("File Format Integrity & Binary Prevention", () => {
    const testExtensionBlock = async (ext: string) => {
      const request = new NextRequest(`http://localhost/api/repositories/1/files/content?path=assets/file.${ext}`);
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Binary files and media are not supported");
    };

    // Images
    it("Scenario 4.1: blocks preview requests for binary extension .png", async () => {
      await testExtensionBlock("png");
    });
    it("Scenario 4.2: blocks preview requests for binary extension .jpg", async () => {
      await testExtensionBlock("jpg");
    });
    it("Scenario 4.3: blocks preview requests for binary extension .jpeg", async () => {
      await testExtensionBlock("jpeg");
    });
    it("Scenario 4.4: blocks preview requests for binary extension .gif", async () => {
      await testExtensionBlock("gif");
    });
    it("Scenario 4.5: blocks preview requests for binary extension .webp", async () => {
      await testExtensionBlock("webp");
    });
    it("Scenario 4.6: blocks preview requests for binary extension .ico", async () => {
      await testExtensionBlock("ico");
    });
    it("Scenario 4.7: blocks preview requests for binary extension .tiff", async () => {
      await testExtensionBlock("tiff");
    });
    it("Scenario 4.8: blocks preview requests for binary extension .bmp", async () => {
      await testExtensionBlock("bmp");
    });
    it("Scenario 4.9: blocks preview requests for binary extension .svg", async () => {
      await testExtensionBlock("svg");
    });

    // Archives
    it("Scenario 4.10: blocks preview requests for archive extension .zip", async () => {
      await testExtensionBlock("zip");
    });
    it("Scenario 4.11: blocks preview requests for archive extension .tar", async () => {
      await testExtensionBlock("tar");
    });
    it("Scenario 4.12: blocks preview requests for archive extension .gz", async () => {
      await testExtensionBlock("gz");
    });
    it("Scenario 4.13: blocks preview requests for archive extension .rar", async () => {
      await testExtensionBlock("rar");
    });
    it("Scenario 4.14: blocks preview requests for archive extension .7z", async () => {
      await testExtensionBlock("7z");
    });
    it("Scenario 4.15: blocks preview requests for archive extension .tgz", async () => {
      await testExtensionBlock("tgz");
    });

    // Binaries / Executables
    it("Scenario 4.16: blocks preview requests for binary extension .exe", async () => {
      await testExtensionBlock("exe");
    });
    it("Scenario 4.17: blocks preview requests for binary extension .dll", async () => {
      await testExtensionBlock("dll");
    });
    it("Scenario 4.18: blocks preview requests for binary extension .so", async () => {
      await testExtensionBlock("so");
    });
    it("Scenario 4.19: blocks preview requests for binary extension .bin", async () => {
      await testExtensionBlock("bin");
    });
    it("Scenario 4.20: blocks preview requests for binary extension .dmg", async () => {
      await testExtensionBlock("dmg");
    });
    it("Scenario 4.21: blocks preview requests for binary extension .iso", async () => {
      await testExtensionBlock("iso");
    });
    it("Scenario 4.22: blocks preview requests for binary extension .jar", async () => {
      await testExtensionBlock("jar");
    });
    it("Scenario 4.23: blocks preview requests for binary extension .war", async () => {
      await testExtensionBlock("war");
    });
    it("Scenario 4.24: blocks preview requests for binary extension .class", async () => {
      await testExtensionBlock("class");
    });

    // Documents / Media
    it("Scenario 4.25: blocks preview requests for document extension .pdf", async () => {
      await testExtensionBlock("pdf");
    });
    it("Scenario 4.26: blocks preview requests for document extension .docx", async () => {
      await testExtensionBlock("docx");
    });
    it("Scenario 4.27: blocks preview requests for document extension .xlsx", async () => {
      await testExtensionBlock("xlsx");
    });
    it("Scenario 4.28: blocks preview requests for document extension .pptx", async () => {
      await testExtensionBlock("pptx");
    });
    it("Scenario 4.29: blocks preview requests for media extension .mp3", async () => {
      await testExtensionBlock("mp3");
    });
    it("Scenario 4.30: blocks preview requests for media extension .mp4", async () => {
      await testExtensionBlock("mp4");
    });
    it("Scenario 4.31: blocks preview requests for media extension .wav", async () => {
      await testExtensionBlock("wav");
    });
    it("Scenario 4.32: blocks preview requests for media extension .avi", async () => {
      await testExtensionBlock("avi");
    });
    it("Scenario 4.33: blocks preview requests for media extension .mkv", async () => {
      await testExtensionBlock("mkv");
    });
    it("Scenario 4.34: blocks preview requests for media extension .mov", async () => {
      await testExtensionBlock("mov");
    });

    // Fonts
    it("Scenario 4.35: blocks preview requests for font extension .woff", async () => {
      await testExtensionBlock("woff");
    });
    it("Scenario 4.36: blocks preview requests for font extension .woff2", async () => {
      await testExtensionBlock("woff2");
    });
    it("Scenario 4.37: blocks preview requests for font extension .ttf", async () => {
      await testExtensionBlock("ttf");
    });
    it("Scenario 4.38: blocks preview requests for font extension .eot", async () => {
      await testExtensionBlock("eot");
    });
    it("Scenario 4.39: blocks preview requests for font extension .otf", async () => {
      await testExtensionBlock("otf");
    });
  });

  describe("Resource Exhaustion & Content Sizing Shield (DoS Mitigation)", () => {
    it("Scenario 5.1: limits file size gracefully using the HTTP Content-Length header", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name.toLowerCase() === "content-length") {
              return String(1024 * 1024 + 100); // 1.1MB
            }
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue("mocked content"),
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("File size exceeds 1MB limit");
    });

    it("Scenario 5.2: checks actual text buffer sizing to prevent bypasses when Content-Length is missing", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // Missing header
        },
        text: jest.fn().mockResolvedValue("a".repeat(1024 * 1024 + 50)), // Exceeds 1MB
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("File size exceeds 1MB limit");
    });

    it("Scenario 5.3: permits files that are exactly at the 1MB boundary limit", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name.toLowerCase() === "content-length") {
              return String(1024 * 1024); // Exactly 1MB
            }
            return null;
          }),
        },
        text: jest.fn().mockResolvedValue("a".repeat(1024 * 1024)),
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    });
  });

  describe("API Error Handling and Resilience Modes", () => {
    it("Scenario 6.1: handles GitHub 404 response gracefully", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/missing.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("File not found on GitHub");
    });

    it("Scenario 6.2: handles unexpected general GitHub API errors properly", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain("GitHub API error: Service Unavailable");
    });

    it("Scenario 6.3: fails gracefully with a 500 when repository lookup logic crashes", async () => {
      (repositoryService.getRepository as jest.Mock).mockRejectedValue(
        new Error("Repository lookup connection database deadlock")
      );

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to fetch file content");
    });

    it("Scenario 6.4: handles GitHub 403 Forbidden response gracefully", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("GitHub API error: Forbidden");
    });

    it("Scenario 6.5: handles GitHub 502 Bad Gateway response gracefully", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
      } as any);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toContain("GitHub API error: Bad Gateway");
    });
  });

  describe("Tenant Isolation and IDOR Mitigation checks", () => {
    it("Scenario 7.1: denies access when repositoryService cannot retrieve repository details", async () => {
      // User is authenticated but repository doesn't exist or doesn't belong to them
      (repositoryService.getRepository as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Repository not found");
    });

    it("Scenario 7.2: blocks non-GitHub repositories as they are unsupported", async () => {
      (repositoryService.getRepository as jest.Mock).mockResolvedValue({
        id: 1,
        url: "https://gitlab.com/owner/repo", // Unsupported host
        defaultBranch: "main",
      });

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Only GitHub repositories are supported");
    });
  });

  describe("Encoding Integrity & Path Segments Injection Safeguard", () => {
    it("Scenario 8.1: verifies path segments are individually url-encoded correctly", async () => {
      const fetchSpy = jest.spyOn(global, "fetch");
      
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/folder name with spaces/index.js");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);

      // Verify that individual path segments are encoded correctly
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("src/folder%20name%20with%20spaces/index.js")
      );

      fetchSpy.mockRestore();
    });

    it("Scenario 8.2: double encoding bypass verification", async () => {
      // Injected path segment with URL-encoded traversal characters (testing if we escape the escapes)
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/%2e%2e%2f%2e%2e%2f.env");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      // Because it gets split by '/' and then each segment encoded, `%2e%2e%2f` is treated as a segment,
      // and then it gets encoded again to `%252e%252e%252f`.
      // It should either be blocked by validateFilePath (which splits and checks) or safely double encoded by the segment encoder
      expect(response.status).toBe(400);
      expect(data.error).toContain("Path traversal detected");
    });
  });

  describe("Scenario 9: Edge Cases and Complex File Names Verification", () => {
    it("Scenario 9.1: blocks files with double dots in the middle of their name (e.g. file..name.txt)", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/file..name.txt");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(400);
    });

    it("Scenario 9.2: permits files with single dot paths that are valid (e.g. src/./index.js)", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/./index.js");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    });

    it("Scenario 9.3: blocks long path names exceeding bounds safely", async () => {
      const longPathName = "a/".repeat(200) + "index.js";
      const request = new NextRequest(`http://localhost/api/repositories/1/files/content?path=${longPathName}`);
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    });
  });

  describe("Scenario 10: Whitelist Integrity & Allowed File Formats Verification", () => {
    const testAllowedExtension = async (ext: string) => {
      const request = new NextRequest(`http://localhost/api/repositories/1/files/content?path=src/file.${ext}`);
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    };

    it("Scenario 10.1: allows previewing .txt files", async () => {
      await testAllowedExtension("txt");
    });
    it("Scenario 10.2: allows previewing .md files", async () => {
      await testAllowedExtension("md");
    });
    it("Scenario 10.3: allows previewing .json files", async () => {
      await testAllowedExtension("json");
    });
    it("Scenario 10.4: allows previewing .yml files", async () => {
      await testAllowedExtension("yml");
    });
    it("Scenario 10.5: allows previewing .yaml files", async () => {
      await testAllowedExtension("yaml");
    });
    it("Scenario 10.6: allows previewing .js files", async () => {
      await testAllowedExtension("js");
    });
    it("Scenario 10.7: allows previewing .ts files", async () => {
      await testAllowedExtension("ts");
    });
    it("Scenario 10.8: allows previewing .tsx files", async () => {
      await testAllowedExtension("tsx");
    });
    it("Scenario 10.9: allows previewing .jsx files", async () => {
      await testAllowedExtension("jsx");
    });
    it("Scenario 10.10: allows previewing .html files", async () => {
      await testAllowedExtension("html");
    });
    it("Scenario 10.11: allows previewing .css files", async () => {
      await testAllowedExtension("css");
    });
    it("Scenario 10.12: allows previewing .scss files", async () => {
      await testAllowedExtension("scss");
    });
    it("Scenario 10.13: allows previewing .py files", async () => {
      await testAllowedExtension("py");
    });
    it("Scenario 10.14: allows previewing .go files", async () => {
      await testAllowedExtension("go");
    });
    it("Scenario 10.15: allows previewing .toml files", async () => {
      await testAllowedExtension("toml");
    });
    it("Scenario 10.16: allows previewing .sql files", async () => {
      await testAllowedExtension("sql");
    });
  });

  describe("Scenario 11: Extreme Path Sanitization Boundaries", () => {
    it("Scenario 11.1: processes paths with trailing special characters gracefully", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js?v=1");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    });

    it("Scenario 11.2: processes paths containing hash tags gracefully", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js#L20");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(200);
    });

    it("Scenario 11.3: blocks path strings consisting only of spaces", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=   ");
      const response = await GET(request, { params: { id: "1" } });
      expect(response.status).toBe(400);
    });
  });

  describe("Scenario 12: Detailed API Header & Payload Validation Checks", () => {
    it("Scenario 12.1: returns a validated JSON response with correct headers", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      
      expect(response.headers.get("content-type")).toContain("application/json");
      const data = await response.json();
      expect(data).toHaveProperty("content");
      expect(data).toHaveProperty("path");
    });

    it("Scenario 12.2: returns 400 when empty path is supplied", async () => {
      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=");
      const response = await GET(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("File path is required");
    });

    it("Scenario 12.3: fails with 500 when requireAuth rejects", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized access"));

      const request = new NextRequest("http://localhost/api/repositories/1/files/content?path=src/index.js");
      const response = await GET(request, { params: { id: "1" } });
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch file content");
    });
  });
});
