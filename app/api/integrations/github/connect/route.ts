import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { GitHubService } from "@/lib/services/githubService";
import { toJsonSafe } from "@/lib/utils/jsonSafe";
import { encryptToken, validateEncryptionConfig } from "@/lib/utils/tokenEncryption";
import { RedactSensitiveFields } from "@/services/security/redact-sensitive-fields";

export async function POST(request: NextRequest) {
  try {
    const encryptionCheck = validateEncryptionConfig();
    if (!encryptionCheck.valid) {
      return NextResponse.json(
        {
          error: "ENCRYPTION_UNAVAILABLE",
          message: "Token encryption is not configured. Contact the administrator.",
        },
        { status: 503 },
      );
    }

    const user = await requireAuth(request);
    const body = await request.json();
    const token = (body?.token as string | undefined)?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "GitHub token is required" },
        { status: 400 },
      );
    }

    const github = new GitHubService(token);
    const me = await github.getAuthenticatedUser();

    const encryptedToken = encryptToken(token);

    const account = await prisma.gitHubAccount.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        githubUserId: BigInt(me.id),
        username: me.login,
        accessToken: encryptedToken,
        tokenEncrypted: true,
      },
      update: {
        githubUserId: BigInt(me.id),
        username: me.login,
        accessToken: encryptedToken,
        tokenEncrypted: true,
      },
      select: {
        id: true,
        userId: true,
        githubUserId: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      RedactSensitiveFields.redact({ account: toJsonSafe(account) }),
      { status: 200 },
    );
  } catch (error: any) {
    console.error("GitHub connect error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to connect GitHub",
      },
      { status: 500 },
    );
  }
}
