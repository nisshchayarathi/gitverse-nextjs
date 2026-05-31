import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

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

  // Only accept the secret via HTTP header to prevent credential leakage
  // through URL query parameters in access logs, proxy logs, and browser history.
  const headerSecret = request.headers.get("x-analysis-runner-secret");
  if (headerSecret && timingSafeCompare(headerSecret, configuredSecret)) {
    return true;
  }

  return false;
}

/**
 * DB-backed throttle to prevent rapid job kicks across serverless instances.
 * Uses the analysisJob table's nextRunAt field to throttle at the DB level.
 */
export async function shouldThrottleJobKick(jobId: string): Promise<boolean> {
  try {
    const job = await prisma.analysisJob.findUnique({
      where: { id: jobId },
      select: { nextRunAt: true, status: true },
    });

    if (!job) return true;

    // If job is already being processed or is not in a kickable state, throttle
    if (job.status === "PROCESSING") return true;

    // If nextRunAt is in the future, throttle
    if (job.nextRunAt && job.nextRunAt > new Date()) return true;

    return false;
  } catch {
    // If DB check fails, allow the request (fail open)
    return false;
  }
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
