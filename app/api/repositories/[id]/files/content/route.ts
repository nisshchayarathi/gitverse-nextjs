import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

const MAX_FILE_PATH_LENGTH = 1024;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// Whitelist of allowed extensions from tests
const ALLOWED_TEXT_EXTENSIONS = [
  "txt", "md", "json", "yml", "yaml", "js", "ts", "tsx", "jsx",
  "html", "css", "scss", "py", "go", "toml", "sql"
];

// Blocklist of sensitive files
const SENSITIVE_FILES = [
  ".env", "config/.env", "deploy.key", "keys/production.pem", 
  "secrets.env", "ssl/nginx.pem", "id_rsa.key"
];

function validateFilePath(filePath: string): string | null {
  if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
    return "File path is required";
  }

  if (filePath.length > MAX_FILE_PATH_LENGTH) {
    return `File path exceeds maximum length of ${MAX_FILE_PATH_LENGTH}`;
  }

  if (filePath.startsWith("/")) {
    return "Absolute path not allowed";
  }

  if (filePath.includes("//")) {
    return "path must not contain empty segments";
  }

  if (filePath.endsWith("/")) {
    return "path must not end with slash";
  }

  if (filePath.includes("\0") || filePath.toLowerCase().includes("%00")) {
    return "Null bytes not allowed";
  }

  // Check for special characters that could be injection vectors
  if (/[<>@!$%^&*(){}[\]|]/.test(filePath)) {
    return "path contains invalid characters";
  }

  let decodedPath = filePath;
  try {
    decodedPath = decodeURIComponent(filePath);
    decodedPath = decodeURIComponent(decodedPath);
  } catch (e) {
    // Ignore decoding errors
  }

  if (decodedPath.includes("\\")) {
    return "Path traversal detected";
  }

  if (decodedPath.includes("\0")) {
    return "Null bytes not allowed";
  }

  const segments = decodedPath.split("/");
  // Check for path traversal (..) first before other checks
  for (const segment of segments) {
    if (segment.includes("..")) {
      return "Path traversal detected";
    }
  }
  // Check for leading . segment (e.g., ./src)
  if (segments.length > 0 && segments[0] === ".") {
    return "path must not contain . segment";
  }

  const lowerPath = filePath.toLowerCase();
  const fileName = lowerPath.split("/").pop() || "";
  for (const sensitive of SENSITIVE_FILES) {
    if (lowerPath === sensitive || fileName === sensitive) {
      return "Access to sensitive files is restricted";
    }
  }

  // Allow dotfiles (e.g., .env.example) unless in sensitive list
  // For regular files, check extension against whitelist
  if (!fileName.startsWith(".")) {
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:[#?].*)?$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      if (!ALLOWED_TEXT_EXTENSIONS.includes(ext)) {
        return "Binary files and media are not supported";
      }
    }
  }

  return null;
}

function encodePathSegments(filePath: string): string {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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

    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.FILE_CONTENT);
    if (!rl.allowed) return rateLimitResponse(rl);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    if (!filePath || filePath.trim() === "") {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    const pathError = validateFilePath(filePath);
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const url = String(repository.url || "");
    const m = url.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i
    );

    if (!m) {
      return NextResponse.json(
        { error: "Only GitHub repositories are supported for file viewing" },
        { status: 400 }
      );
    }

    const owner = m[1];
    const repo = m[2];
    const branch = String(repository.defaultBranch || "main");

    const encodedPath = encodePathSegments(filePath);
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;

    let signal: AbortSignal | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    const controller = new AbortController();

    if (typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(10000);
    } else {
      timeoutId = setTimeout(() => controller.abort(), 10000);
      signal = controller.signal;
    }

    let response: Response;
    try {
      response = await fetch(rawUrl, {
        headers: { Accept: "text/plain" },
        signal,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "File not found on GitHub" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `GitHub API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const size = parseInt(contentLengthHeader, 10);
      if (size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File size is too large" }, { status: 413 });
      }
    }

    const content = await response.text();
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size is too large" }, { status: 413 });
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
