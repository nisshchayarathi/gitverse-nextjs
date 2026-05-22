import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { GitHubRateLimitError } from "@/lib/services/githubService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const repoFullNames = Array.isArray(body?.repoFullNames)
      ? (body.repoFullNames as unknown[])
          .filter((r) => typeof r === "string")
          .map((r) => r.trim())
      : [];

    if (repoFullNames.length === 0) {
      return NextResponse.json(
        { error: "repoFullNames must be a non-empty array" },
        { status: 400 },
      );
    }

    // Upsert selected repos as enabled.
    await prisma.$transaction(async (tx) => {
      for (const fullName of repoFullNames) {
        await tx.gitHubRepo.upsert({
          where: {
            userId_repoFullName: {
              userId: user.userId,
              repoFullName: fullName,
            },
          },
          create: {
            userId: user.userId,
            repoFullName: fullName,
            enabled: true,
          },
          update: {
            enabled: true,
          },
        });
      }

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
    console.error("GitHub select repos error:", error);
    
    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 }
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
