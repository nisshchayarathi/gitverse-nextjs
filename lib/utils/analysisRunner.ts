import { NextRequest } from "next/server";
import crypto from "crypto";

const lastKickAtByJobId = new Map<string, number>();

const EPHEMERAL_SECRET = !process.env.ANALYSIS_RUNNER_SECRET
  ? crypto.randomBytes(32).toString("hex")
  : undefined;

export function getEphemeralSecret(): string | undefined {
  return EPHEMERAL_SECRET;
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAnalysisRunnerAuthorized(request: NextRequest): boolean {
  const configuredSecret =
    process.env.ANALYSIS_RUNNER_SECRET || EPHEMERAL_SECRET;

  if (!configuredSecret) {
    return false;
  }

  const headerSecret = request.headers.get("x-analysis-runner-secret");
  if (headerSecret && timingSafeCompare(headerSecret, configuredSecret)) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret && timingSafeCompare(querySecret, configuredSecret)) {
    return true;
  }

  return false;
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
