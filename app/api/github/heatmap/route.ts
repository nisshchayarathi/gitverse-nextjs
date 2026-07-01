import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth, sanitizeError } from "@/lib/middleware";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const rateLimitResult = await checkRateLimit(String(user.userId), RATE_LIMITS.AI_GLOBAL);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    const { searchParams } = req.nextUrl;
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
        next: { revalidate: 3600 },
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
  } catch (error: any) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: sanitizeError(error) || "Internal server error" }, { status: 500 });
  }
}
