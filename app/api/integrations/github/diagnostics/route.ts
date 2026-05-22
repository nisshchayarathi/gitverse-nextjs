import { NextRequest, NextResponse } from "next/server";
import { GitHubAppService } from "@/lib/services/githubAppService";
import axios, { isAxiosError } from "axios";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization Check (aligns with internal run-analysis cron pattern)
    const authHeader = request.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && !process.env.ANALYSIS_RUNNER_SECRET) {
      console.warn("Diagnostics endpoint accessed in production without ANALYSIS_RUNNER_SECRET configured.");
      return NextResponse.json({ error: "Diagnostics unauthorized" }, { status: 401 });
    }

    if (
      process.env.ANALYSIS_RUNNER_SECRET &&
      authHeader !== `Bearer ${process.env.ANALYSIS_RUNNER_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Configuration Readiness Checks
    const config = {
      hasAppId: !!process.env.GITHUB_APP_ID?.trim(),
      hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY?.trim(),
      hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET?.trim(),
    };

    const isConfigReady = config.hasAppId && config.hasPrivateKey;

    let apiReachable = false;
    let authValid = false;
    let rateLimit = null;
    let errorDetails = null;

    // 3. Connectivity & Rate Limit Check
    if (isConfigReady) {
      try {
        const appService = new GitHubAppService();
        const appJwt = appService.createAppJwt();
        
        // Use a short timeout so the diagnostics endpoint is fast
        const response = await axios.get("https://api.github.com/rate_limit", {
          timeout: 5000,
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          }
        });

        apiReachable = true;
        authValid = true;
        
        // Extract rate limit data (GitHub Apps get their own core rate limit)
        const rateData = response.data?.resources?.core;
        if (rateData) {
          rateLimit = {
            limit: rateData.limit,
            remaining: rateData.remaining,
            reset: rateData.reset, // Unix epoch seconds
          };
        }
      } catch (error) {
        // Safe Error Handling
        if (isAxiosError(error)) {
          if (error.response) {
            apiReachable = true; // We reached GitHub but got a bad status
            authValid = error.response.status !== 401 && error.response.status !== 403;
            errorDetails = `GitHub API returned status ${error.response.status}`;
            
            // If it's a rate limit error itself, we can parse headers
            if (error.response.status === 403 || error.response.status === 429) {
              const remaining = error.response.headers["x-ratelimit-remaining"];
              const reset = error.response.headers["x-ratelimit-reset"];
              const limit = error.response.headers["x-ratelimit-limit"];
              if (remaining != null) {
                rateLimit = {
                  limit: limit ? parseInt(limit, 10) : null,
                  remaining: parseInt(remaining, 10),
                  reset: reset ? parseInt(reset, 10) : null,
                };
              }
            }
          } else if (error.request) {
            apiReachable = false;
            errorDetails = "Failed to connect to GitHub API (timeout or network error)";
          } else {
            errorDetails = error.message;
          }
        } else {
          errorDetails = "Internal configuration error during diagnostics";
        }
        
        console.error("GitHub diagnostics check failed:", errorDetails);
      }
    }

    const payload = {
      status: "ok",
      diagnostics: {
        configReady: isConfigReady,
        config,
      },
      connectivity: {
        apiReachable,
        authValid,
        rateLimit,
      },
      error: errorDetails,
      timestamp: new Date().toISOString(),
    };

    // Return 200 even if degraded, so clients can read the structured JSON
    // We only use 5xx if the diagnostics endpoint itself crashes
    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error("Critical error in GitHub diagnostics endpoint:", error.message);
    return NextResponse.json(
      { error: "Diagnostics endpoint failure" },
      { status: 500 }
    );
  }
}
