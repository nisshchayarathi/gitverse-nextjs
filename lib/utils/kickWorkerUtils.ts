import { NextRequest } from "next/server";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/middleware";

export function kickLocalRunner(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;
  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
  if (!secret) return;
  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: { "x-analysis-runner-secret": secret },
  }).catch(() => {
    // Best-effort only.
  });
}

export function kickProductionWorker() {
  if (process.env.NODE_ENV !== "production") return;
  void triggerAnalysisWorkerWorkflow().catch((error) => {
    logger.error(
      { err: sanitizeError(error) },
      "Failed to dispatch analysis worker workflow",
    );
  });
}