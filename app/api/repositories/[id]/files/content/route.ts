import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

const MAX_FILE_PATH_LENGTH = 1024;
const DANGEROUS_PATTERNS = [
  /\.\./,           // path traversal
  /\0/,             // null bytes
  /^\.+$/,          // only dots
  /\\/g,            // backslashes (Windows-style)
];

const ALLOWED_PATH_SEGMENTS = /^[a-zA-Z0-9._\-\/]+$/;

/**
 * Validates a file path for safe use in URL construction.
 * Returns null if valid, or an error message if invalid.
 */
function validateFilePath(filePath: string): string | null {
  if (!filePath || typeof filePath !== "string") {
    return "File path is required";
  }

  if (filePath.length > MAX_FILE_PATH_LENGTH) {
    return `File path exceeds maximum length of ${MAX_FILE_PATH_LENGTH}`;
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filePath)) {
      return "File path contains invalid characters";
    }
  }

  // Must start with a letter, number, or dot (for relative paths like ./src)
  // but not start with a dot followed by a slash (which is traversal)
  if (filePath.startsWith("/")) {
    return "File path must not start with /";
  }

  // Split into segments and validate each
  const segments = filePath.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      return "File path contains disallowed segments";
    }
  }

  // Validate characters in path
  if (!ALLOWED_PATH_SEGMENTS.test(filePath)) {
    return "File path contains invalid characters";
  }

  return null;
}

/**
 * Encodes each segment of a file path individually, preserving slashes.
 * This prevents path traversal while maintaining the path structure.
 */
function encodePathSegments(filePath: string): string {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Determines if a file extension is a text-based file that's safe to return.
 * Binary files could be used for data exfiltration or DoS.
 */
function isTextFile(filePath: string): boolean {
  const textExtensions = [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".jsonc", ".json5",
    ".md", ".mdx", ".txt", ".rst",
    ".css", ".scss", ".less",
    ".html", ".htm", ".xml", ".svg",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".env", ".env.local", ".env.example",
    ".gitignore", ".gitattributes", ".gitmodules",
    ".dockerignore", ".dockerfile",
    ".eslintrc", ".prettierrc", ".babelrc",
    ".editorconfig", ".npmrc", ".nvmrc",
    ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
    ".sh", ".bash", ".zsh", ".fish",
    ".sql", ".graphql", ".gql",
    ".prisma", ".graphqlrc",
    ".lock",  // package-lock.json etc.
    "Makefile", "Dockerfile", "Procfile",
    "LICENSE", "README", "CHANGELOG", "CONTRIBUTING",
  ];

  const lowerPath = filePath.toLowerCase();

  // Check if path ends with a known text extension
  for (const ext of textExtensions) {
    if (lowerPath.endsWith(ext)) {
      return true;
    }
  }

  // Allow files with no extension (often config files)
  const lastSlash = filePath.lastIndexOf("/");
  const filename = lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
  if (!filename.includes(".")) {
    return true;
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const id = parseInt(params.id);
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Validate file path to prevent path traversal
    const pathError = validateFilePath(filePath);
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    // Reject binary files to prevent data exfiltration
    if (!isTextFile(filePath)) {
      return NextResponse.json(
        { error: "Only text files are supported for file viewing" },
        { status: 400 }
      );
    }

    const validatedError = validateFilePath(filePath);
    if (validatedError) {
      return NextResponse.json({ error: validatedError }, { status: 400 });
    }

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Parse GitHub URL to extract owner/repo
    const url = String(repository.url || "");
    const m = url.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i
    );

    if (!m) {
      return NextResponse.json(
        {
          error:
            "Only GitHub repositories are supported for file viewing",
        },
        { status: 400 }
      );
    }

    const owner = m[1];
    const repo = m[2];
    const branch = String(repository.defaultBranch || "main");

    // Encode each path segment to prevent traversal while preserving structure
    const encodedPath = encodePathSegments(filePath);

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;

    const response = await fetch(rawUrl, {
      headers: {
        Accept: "text/plain",
      },
      // Limit response size to prevent DoS via huge files
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "File not found on GitHub" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: `GitHub API error: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    // Limit content size to prevent memory exhaustion
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large to display (max 1MB)" },
        { status: 413 }
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const size = parseInt(contentLengthHeader, 10);
      if (size > 1024 * 1024) { // 1MB limit
        return NextResponse.json({ error: "File size exceeds 1MB limit" }, { status: 400 });
      }
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds maximum preview size of 5 MB" }, { status: 413 });
    }

    const content = await response.text();
    if (content.length > 1024 * 1024) { // 1MB limit
      return NextResponse.json({ error: "File size exceeds 1MB limit" }, { status: 400 });
    }

    // Double-check content size after reading
    if (content.length > 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large to display (max 1MB)" },
        { status: 413 }
      );
    }

    if (content.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds maximum preview size of 5 MB" }, { status: 413 });
    }

    return NextResponse.json({ content, path: filePath });
  } catch (error: any) {
    console.error("Error fetching file content:", sanitizeError(error));

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch file content" },
      { status: 500 }
    );
  }
}
