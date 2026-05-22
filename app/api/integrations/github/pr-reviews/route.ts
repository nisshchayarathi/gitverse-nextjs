import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { isValidRepositoryIdentifier } from "@/lib/utils/validators";

function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const n = value == null ? NaN : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const repoFullName = (url.searchParams.get("repoFullName") || "").trim();
    
    if (repoFullName && !isValidRepositoryIdentifier(repoFullName)) {
      return NextResponse.json(
        { error: "Invalid repository identifier format" },
        { status: 400 }
      );
    }

    const includeDisabled = (url.searchParams.get("includeDisabled") || "")
      .trim()
      .toLowerCase();
    const limit = clampInt(url.searchParams.get("limit"), 20, 1, 100);

    const repos = await prisma.gitHubRepo.findMany({
      where: {
        userId: user.userId,
        ...(repoFullName ? { repoFullName } : {}),
        ...(includeDisabled === "true" ? {} : { enabled: true }),
      },
      orderBy: [{ enabled: "desc" }, { repoFullName: "asc" }],
      select: {
        id: true,
        repoFullName: true,
        enabled: true,
        installationId: true,
        pullRequests: {
          orderBy: [{ updatedAt: "desc" }],
          take: limit,
          select: {
            id: true,
            prNumber: true,
            title: true,
            author: true,
            headSha: true,
            htmlUrl: true,
            status: true,
            updatedAt: true,
            reviews: {
              orderBy: [{ createdAt: "desc" }],
              take: 1,
              select: {
                id: true,
                createdAt: true,
                reviewText: true,
              },
            },
          },
        },
      },
    });

    if (repoFullName && repos.length === 0) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { repos: toJsonSafe(repos) },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error: any) {
    console.error("GitHub PR reviews error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to load PR reviews",
      },
      { status: 500 },
    );
  }
}
