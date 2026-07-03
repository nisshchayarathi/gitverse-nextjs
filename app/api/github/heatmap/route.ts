import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { checkAiRateLimit } from "@/lib/utils/ipRateLimit";
import { getClientIp } from "@/lib/services/rateLimitService";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const HEATMAP_RATE_LIMIT = 30;
const HEATMAP_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const allowed = await checkAiRateLimit(
      String(user.userId),
      "userId",
      "heatmap",
      HEATMAP_RATE_LIMIT,
      HEATMAP_WINDOW_MS,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before requesting another heatmap." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `;

    const response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login: username } }),
      next: { revalidate: 3600 }, // cache 1hr
    });

    if (!response.ok) {
      return NextResponse.json({ error: "GitHub API error" }, { status: response.status });
    }

    const data = await response.json();

    if (data.errors) {
      return NextResponse.json({ error: data.errors[0].message }, { status: 400 });
    }

    const calendar =
      data?.data?.user?.contributionsCollection?.contributionCalendar;

    if (!calendar) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(calendar);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch heatmap" },
      { status: 500 },
    );
  }
}
