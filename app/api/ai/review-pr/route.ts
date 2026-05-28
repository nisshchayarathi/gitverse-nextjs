import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError, isHttpError } from "@/lib/middleware";
import {
  parsePullRequestUrl,
  reviewPullRequest,
} from "@/lib/services/prReviewService";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const prUrl = body?.prUrl as string | undefined;

    if (!prUrl) {
      return NextResponse.json({ error: "prUrl is required" }, { status: 400 });
    }

    const parsed = parsePullRequestUrl(prUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Invalid PR URL. Expected https://github.com/{owner}/{repo}/pull/{number}",
        },
        { status: 400 },
      );
    }

    // Retrieve the GitHub token stored for this user via /api/integrations/github/connect.
    // The token is never accepted from the request body to prevent token laundering,
    // scope probing, and rate limit exhaustion through server-side proxying.
    const account = await prisma.gitHubAccount.findUnique({
      where: { userId: user.userId },
      select: { accessToken: true },
    });

    if (!account?.accessToken) {
      return NextResponse.json(
        {
          error:
            "GitHub account not connected. Connect your GitHub account in Settings before using PR review.",
        },
        { status: 400 },
      );
    }

    const result = await reviewPullRequest({
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      githubToken: account.accessToken,
    });

    return NextResponse.json({
      review: result.review,
      pr: { url: result.prUrl || prUrl, title: result.prTitle },
    });
  } catch (error: any) {
    console.error("PR review error:", sanitizeError(error));
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Malformed JSON body" },
        { status: 400 },
      );
    }
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to review PR" },
      { status: 500 },
    );
  }
}
