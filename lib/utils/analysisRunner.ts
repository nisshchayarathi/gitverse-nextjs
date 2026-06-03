import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

function getRequiredSecret(): string {
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[AnalysisRunner] ANALYSIS_RUNNER_SECRET is not set. " +
        "The endpoint will reject all requests until it is configured. " +
        "Generate one with: openssl rand -hex 32"
      );
    }
    return "";
  }
  return secret;
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
  const configuredSecret = getRequiredSecret();

  if (!configuredSecret) {
    return false;
  }

  const headerSecret = request.headers.get("x-analysis-runner-secret");
  if (headerSecret && timingSafeCompare(headerSecret, configuredSecret)) {
    return true;
  }

  return false;
}

export async function shouldThrottleJobKick(jobId: string): Promise<boolean> {
  try {
    const job = await prisma.analysisJob.findUnique({
      where: { id: jobId },
      select: { nextRunAt: true, status: true },
    });

    if (!job) return true;

    if (job.status === "PROCESSING") return true;

    if (job.nextRunAt && job.nextRunAt > new Date()) return true;

    return false;
  } catch {
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
