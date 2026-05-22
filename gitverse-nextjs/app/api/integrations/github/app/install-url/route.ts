import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { createSignedState } from "@/lib/utils/signedState";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
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
    console.error("GitHub App install-url error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
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
