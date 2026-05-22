import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { GitHubService, GitHubRateLimitError } from "@/lib/services/githubService";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { url, token } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "GitHub token is required" },
        { status: 400 }
      );
    }

    const parsed = GitHubService.parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    const github = new GitHubService(token);
    const valid = await github.validateToken();
    if (!valid) {
      return NextResponse.json(
        {
          error:
            "Your GitHub token is invalid or has expired. Reconnect your GitHub account and provide a fresh token.",
        },
        { status: 401 },
      );
    }
    const repoData = await github.getRepository(parsed.owner, parsed.repo);

    if (!repoData) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const repository = await repositoryService.createRepository({
      name: repoData.name,
      url: repoData.clone_url,
      description: repoData.description || undefined,
      userId: user.userId,
    });

    return NextResponse.json({ repository, source: "github" }, { status: 201 });
  } catch (error: any) {
    console.error("GitHub import error:", sanitizeErrorMessage(error));

    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
