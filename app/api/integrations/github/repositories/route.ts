import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { isHttpError, requireAuth } from "@/lib/middleware";
import {
  GitHubService,
  GitHubRateLimitError,
} from "@/lib/services/githubService";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";
=======
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { GitHubService } from "@/lib/services/githubService";
>>>>>>> upstream/main
import prisma from "@/lib/prisma";

function clampInt(
  value: string | number | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const n = value == null ? NaN : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const tokenFromBody = (body?.token as string | undefined)?.trim();
    const username = (body?.username as string | undefined)?.trim();
    const page = clampInt(body?.page, 1, 1, 1000);
    const per_page = clampInt(body?.per_page, 30, 1, 100);

    const token =
      tokenFromBody ||
      (
        await prisma.gitHubAccount.findUnique({
          where: { userId: user.userId },
          select: { accessToken: true },
        })
      )?.accessToken;

    if (token) {
      const github = new GitHubService(token);
      const result = await github.listUserRepositories(username, {
        page,
        per_page,
        max_pages: 1, // Single page by default for Vercel safety
      });
      return NextResponse.json({
        repositories: result.repositories,
        source: "user-token",
        page,
        per_page,
        nextPage: result.nextPage,
      });
    }

    // GitHub App flow fallback: return repos we already learned from installation callback.
    const repos = await prisma.gitHubRepo.findMany({
      where: { userId: user.userId },
      orderBy: [{ enabled: "desc" }, { repoFullName: "asc" }],
      select: { id: true, repoFullName: true, enabled: true },
    });

    if (repos.length === 0) {
      return NextResponse.json(
        {
          error:
            "No GitHub token or GitHub App repos found in DB. If you installed the app but weren’t redirected back, set the GitHub App Setup URL to /api/integrations/github/app/callback, or use the Sync Installation option in Contribute.",
        },
        { status: 400 },
      );
    }

    // Shape to match GitHub API response used by the UI.
    const repositories = repos.map((r) => ({
      id: r.id,
      full_name: r.repoFullName,
      private: true,
      html_url: `https://github.com/${r.repoFullName}`,
      _source: "db" as const,
      _enabled: r.enabled,
    }));

    // Reuse the parsed pagination values (same defaults as token path)
    const start = (page - 1) * per_page;
    const pageItems = repositories.slice(start, start + per_page);

    // Compute nextPage: if we have more items than the current page, there's a next page
    const totalPages = Math.ceil(repositories.length / per_page);
    const nextPage = page < totalPages ? page + 1 : undefined;

    return NextResponse.json({
      repositories: pageItems,
      source: "github-app-db",
      page,
      per_page,
      nextPage,
    });
  } catch (error: any) {
<<<<<<< HEAD
    console.error("GitHub repositories error:", sanitizeErrorMessage(error));

    if (error instanceof GitHubRateLimitError) {
      const headers =
        error.retryAfterSeconds !== undefined
          ? { "Retry-After": String(error.retryAfterSeconds) }
          : undefined;
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429, headers },
      );
    }

=======
    console.error("GitHub repositories error:", sanitizeError(error));
>>>>>>> upstream/main
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch GitHub repositories" },
      { status: 500 },
    );
  }
}
