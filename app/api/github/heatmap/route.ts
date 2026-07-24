import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export async function GET(req: NextRequest) {
  // Require authentication so only logged-in users can query contribution heatmaps
  const authUser = await requireAuth(req);

  // Per-user rate limiting to prevent abuse of the GitHub GraphQL API
  const rl = await checkRateLimit(String(authUser.userId), RATE_LIMITS.GITHUB_HEATMAP);
  if (!rl.allowed) return rateLimitResponse(rl);

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

  try {
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
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch heatmap" }, { status: 500 });
  }
}
