import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { GitHubService } from "@/lib/services/githubService";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const tokenFromBody = (body?.token as string | undefined)?.trim();
    const username = (body?.username as string | undefined)?.trim();

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
      const repositories = await github.listUserRepositories(username);
      return NextResponse.json({ repositories, source: "user-token" });
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

    return NextResponse.json({ repositories, source: "github-app-db" });
  } catch (error: any) {
    console.error("GitHub repositories error:", sanitizeError(error));
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
