import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  parsePullRequestUrl,
  reviewPullRequest,
} from "@/lib/services/prReviewService";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const prUrl = body?.prUrl as string | undefined;
    const token = body?.token as string | undefined;

    if (!prUrl) {
      return NextResponse.json({ error: "prUrl is required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
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
    const result = await reviewPullRequest({
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      githubToken: token,
    });

    return NextResponse.json({
      review: result.review,
      pr: { url: result.prUrl || prUrl, title: result.prTitle },
    });
  } catch (error: any) {
    console.error("PR review error:", error);
    return NextResponse.json(
      {
        error: "Failed to review PR",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: "Failed to review PR", details: "Unexpected fallthrough" },
    { status: 500 },
  );
}
