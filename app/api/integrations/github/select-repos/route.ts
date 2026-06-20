import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { GitHubRateLimitError } from "@/lib/services/githubService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.GITHUB_SELECT_REPOS);
    if (!rl.allowed) return rateLimitResponse(rl);
    const body = await request.json();
    const repoFullNames = Array.isArray(body?.repoFullNames)
      ? Array.from(
          new Set(
            (body.repoFullNames as unknown[])
              .filter((r): r is string => typeof r === "string")
              .map((r) => r.trim())
              .filter(Boolean),
          ),
        )
      : [];

    if (repoFullNames.length === 0) {
      return NextResponse.json(
        { error: "repoFullNames must be a non-empty array" },
        { status: 400 },
      );
    }

    const selectableRepos = await prisma.gitHubRepo.findMany({
      where: {
        userId: user.userId,
        repoFullName: { in: repoFullNames },
        installationId: { not: null },
      },
      select: { repoFullName: true },
    });

    const selectableRepoNames = new Set(
      selectableRepos.map((repo) => repo.repoFullName),
    );
    const unavailableRepoFullNames = repoFullNames.filter(
      (repoFullName) => !selectableRepoNames.has(repoFullName),
    );

    if (unavailableRepoFullNames.length > 0) {
      return NextResponse.json(
        {
          error:
            "Selected repositories must be installed through the GitHub App first",
          unavailableRepoFullNames,
        },
        { status: 400 },
      );
    }

    // Enable only repos already discovered through the user's GitHub App installation.
    await prisma.$transaction(async (tx) => {
      await tx.gitHubRepo.updateMany({
        where: {
          userId: user.userId,
          repoFullName: { in: repoFullNames },
          installationId: { not: null },
        },
        data: { enabled: true },
      });

      // Optionally disable repos not selected (keeps history but turns off automation).
      await tx.gitHubRepo.updateMany({
        where: {
          userId: user.userId,
          repoFullName: { notIn: repoFullNames },
        },
        data: { enabled: false },
      });
    });

    const repos = await prisma.gitHubRepo.findMany({
      where: { userId: user.userId },
      orderBy: [{ enabled: "desc" }, { repoFullName: "asc" }],
      select: {
        id: true,
        repoFullName: true,
        enabled: true,
        installationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ repos: toJsonSafe(repos) }, { status: 200 });
  } catch (error: any) {
    console.error("GitHub select repos error:", sanitizeError(error));

    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 },
      );
    }

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to save selected repos",
      },
      { status: 500 },
    );
  }
}
