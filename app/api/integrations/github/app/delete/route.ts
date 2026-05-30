import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { GitHubAppService } from "@/lib/services/githubAppService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Try to uninstall the GitHub App from GitHub first (best-effort).
    // A single user can theoretically have multiple installationIds across repos.
    const installationRows = await prisma.gitHubRepo.findMany({
      where: { userId: user.userId, installationId: { not: null } },
      select: { installationId: true },
    });

    const installationIds = Array.from(
      new Set(
        installationRows
          .map((r) =>
            r.installationId != null ? String(r.installationId) : "",
          )
          .filter(Boolean),
      ),
    );

    const uninstallResults: Array<{
      installationId: string;
      ok: boolean;
      error?: string;
    }> = [];

    if (installationIds.length > 0) {
      try {
        const app = new GitHubAppService();
        for (const idStr of installationIds) {
          const idNum = Number(idStr);
          if (!Number.isFinite(idNum)) {
            uninstallResults.push({
              installationId: idStr,
              ok: false,
              error: "installationId_not_numeric",
            });
            continue;
          }

          try {
            await app.uninstallInstallation(idNum);
            uninstallResults.push({ installationId: idStr, ok: true });
          } catch (e: any) {
            uninstallResults.push({
              installationId: idStr,
              ok: false,
              error:
                e?.response?.data?.message || e?.message || "uninstall_failed",
            });
          }
        }
      } catch (e: any) {
        // If GitHub App env vars aren't configured, or GitHub rejects the request,
        // we still proceed with DB cleanup.
        console.warn(
          "GitHub uninstall skipped/failed (continuing with DB cleanup):",
          e?.message || e,
        );
      }
    }

    // Deleting GitHub repos will cascade-delete pull requests and reviews (see schema onDelete: Cascade).
    const [deletedRepos, deletedAccount] = await prisma.$transaction([
      prisma.gitHubRepo.deleteMany({ where: { userId: user.userId } }),
      prisma.gitHubAccount.deleteMany({ where: { userId: user.userId } }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        deleted: {
          repos: deletedRepos.count,
          githubAccount: deletedAccount.count,
        },
        uninstall: uninstallResults,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GitHub App delete error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to delete GitHub App data",
      },
      { status: 500 },
    );
  }
}
