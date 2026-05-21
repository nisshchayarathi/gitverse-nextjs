import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { GitHubAppService } from "@/lib/services/githubAppService";
import { GitHubService } from "@/lib/services/githubService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // Body is optional; allow syncing based on stored installationId(s).
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const installationIdRaw = body?.installationId;
    const installationIdFromBody = Number(installationIdRaw);

    let installationIds: number[] = [];
    if (Number.isFinite(installationIdFromBody) && installationIdFromBody > 0) {
      installationIds = [installationIdFromBody];
    } else {
      const rows = await prisma.gitHubRepo.findMany({
        where: { userId: user.userId, installationId: { not: null } },
        select: { installationId: true },
      });
      const ids = rows
        .map((r) => (r.installationId != null ? Number(r.installationId) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0);
      installationIds = Array.from(new Set(ids));
    }

    if (installationIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No GitHub App installation found for this user. Install the GitHub App first, then try syncing again.",
        },
        { status: 400 },
      );
    }

    const app = new GitHubAppService();

    const results: Array<{ installationId: number; reposSeen: number }> = [];
    let totalReposSeen = 0;

    for (const installationId of installationIds) {
      const installationToken =
        await app.getInstallationAccessToken(installationId);
      const github = new GitHubService(installationToken);

      const repos: { full_name: string }[] = [];
      for (let page = 1; page <= 10; page++) {
        const { repositories } = await github.listInstallationRepositories({
          per_page: 100,
          page,
        });
        if (!repositories.length) break;
        repos.push(...repositories.map((r) => ({ full_name: r.full_name })));
        if (repositories.length < 100) break;
      }

      if (repos.length === 0) {
        results.push({ installationId, reposSeen: 0 });
        continue;
      }

      // Avoid interactive transactions here (P2028 timeouts under small pools / Neon).
      const rows = repos.map((r) => ({
        userId: user.userId,
        repoFullName: r.full_name,
        enabled: false,
        installationId: BigInt(installationId),
      }));

      await prisma.gitHubRepo.createMany({
        data: rows,
        skipDuplicates: true,
      });

      // Update installationId for any existing rows.
      const chunkSize = 200;
      for (let i = 0; i < repos.length; i += chunkSize) {
        const chunk = repos.slice(i, i + chunkSize).map((r) => r.full_name);
        await prisma.gitHubRepo.updateMany({
          where: {
            userId: user.userId,
            repoFullName: { in: chunk },
          },
          data: { installationId: BigInt(installationId) },
        });
      }

      results.push({ installationId, reposSeen: repos.length });
      totalReposSeen += repos.length;
    }

    return NextResponse.json(
      {
        ok: true,
        installationIds,
        results,
        reposSeen: totalReposSeen,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GitHub App sync error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to sync GitHub App installation repos",
      },
      { status: 500 },
    );
  }
}
