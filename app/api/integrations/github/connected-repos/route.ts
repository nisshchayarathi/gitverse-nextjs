import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { RedactSensitiveFields } from "@/services/security/redact-sensitive-fields";

export const dynamic = "force-dynamic";

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
      RedactSensitiveFields.redact({ account: toJsonSafe(account), repos: toJsonSafe(repos) }),
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GitHub connected repos error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to load connected repos",
      },
      { status: 500 },
    );
  }
}
