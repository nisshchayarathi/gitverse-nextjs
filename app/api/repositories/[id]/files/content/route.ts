import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

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
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const repository = await repositoryService.getRepository(id, user.userId);

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // Attempt to fetch from raw.githubusercontent.com
    const url = String(repository.url || "");
    const m = url.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i
    );
    
    if (!m) {
      return NextResponse.json({ error: "Only GitHub repositories are supported for file viewing" }, { status: 400 });
    }

    const owner = m[1];
    const repo = m[2];
    const branch = String(repository.defaultBranch || "main");
    
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${filePath}`;

    const response = await fetch(rawUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "File not found on GitHub" }, { status: 404 });
      }
      return NextResponse.json({ error: `GitHub API error: ${response.statusText}` }, { status: response.status });
    }

    const content = await response.text();

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
