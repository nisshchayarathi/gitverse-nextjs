import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";
import { toJsonSafe } from "@/lib/utils/jsonSafe";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const account = await prisma.gitHubAccount.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        username: true,
        githubUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const repos = await prisma.gitHubRepo.findMany({
      where: { userId: user.userId },
      orderBy: [{ enabled: "desc" }, { repoFullName: "asc" }],
      select: {
        id: true,
        repoFullName: true,
        installationId: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { account: toJsonSafe(account), repos: toJsonSafe(repos) },
      { 
        status: 200,
        headers: { "Cache-Control": "no-store" }
      },
    );
  } catch (error: any) {
    console.error("GitHub connected repos error:", sanitizeErrorMessage(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { 
          status: error.status,
          headers: { "Cache-Control": "no-store" }
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to load connected repos" },
      { 
        status: 500,
        headers: { "Cache-Control": "no-store" }
      },
    );
  }
}
