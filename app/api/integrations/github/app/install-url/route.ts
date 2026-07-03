import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { createSignedState } from "@/lib/utils/signedState";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function isGitHubAppConfigured(): boolean {
  return !!process.env.GITHUB_APP_ID?.trim() &&
    !!process.env.GITHUB_APP_PRIVATE_KEY?.trim() &&
    !!process.env.GITHUB_APP_SLUG?.trim();
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const slug = getRequiredEnv("GITHUB_APP_SLUG");
    const state = createSignedState({
      userId: user.userId,
      ts: Date.now(),
      nonce: Math.random().toString(36).slice(2),
    });

    const url = `https://github.com/apps/${encodeURIComponent(
      slug,
    )}/installations/new?state=${encodeURIComponent(state)}`;

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    console.error("GitHub App install-url error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    // Distinguish between misconfiguration and runtime errors (issue #53).
    if (!isGitHubAppConfigured()) {
      return NextResponse.json(
        {
          error:
            "GitHub App is not configured on this server. Please contact the administrator to set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG environment variables.",
          code: "GITHUB_APP_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to create install URL",
      },
      { status: 500 },
    );
  }
}
