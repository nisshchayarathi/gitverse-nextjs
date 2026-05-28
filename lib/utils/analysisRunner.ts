import { NextRequest } from "next/server";

const lastKickAtByJobId = new Map<string, number>();

export function isAnalysisRunnerAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET;

  if (configuredSecret && request.method !== "GET") {
    const headerSecret = request.headers.get("x-analysis-runner-secret");

    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");

    return (
      headerSecret === configuredSecret ||
      querySecret === configuredSecret
    );
  }

  const ua = (
    request.headers.get("user-agent") || ""
  ).toLowerCase();

  const isVercelCron =
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "production" &&
    ua.includes("vercel-cron/");

  if (request.method === "GET" && isVercelCron) {
    return true;
  }

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-analysis-runner-secret");

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  return (
    headerSecret === configuredSecret ||
    querySecret === configuredSecret
  );
}

export function shouldThrottleJobKick(jobId: string): boolean {
  const now = Date.now();

  const lastKickAt = lastKickAtByJobId.get(jobId) ?? 0;

  if (now - lastKickAt < 5000) {
    return true;
  }

  lastKickAtByJobId.set(jobId, now);

  return false;
}

export function registerUnhandledRejectionLogger() {
  if ((globalThis as any).__analysisRunnerUnhandledRegistered) {
    return;
  }

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection in analysis runner:", reason);
  });

  (globalThis as any).__analysisRunnerUnhandledRegistered = true;
}