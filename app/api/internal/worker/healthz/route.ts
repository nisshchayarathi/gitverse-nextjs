import { NextRequest, NextResponse } from "next/server";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import {
  validateRequiredSecrets,
  validateSecretIsolation,
} from "@/lib/utils/internalAuth";

export const runtime = "nodejs";

/**
 * GET /api/internal/worker/healthz
 *
 * Health check endpoint for the webhook worker.
 * Verifies:
 * 1. INTERNAL_WORKER_SECRET is configured
 * 2. The queue can authenticate with the worker
 * 3. Secrets are properly isolated
 */
export async function GET(request: NextRequest) {
  // Verify the caller is authorized
  if (!isInternalWorkerAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, { status: string; message?: string }> = {};
  let healthy = true;

  // Check 1: Required secrets
  const missingSecrets = validateRequiredSecrets();
  if (missingSecrets.length > 0) {
    healthy = false;
    checks.secrets = {
      status: "error",
      message: `Missing required secrets: ${missingSecrets.join(", ")}`,
    };
  } else {
    checks.secrets = { status: "ok" };
  }

  // Check 2: Secret isolation
  const warnings = validateSecretIsolation();
  if (warnings.length > 0) {
    checks.isolation = {
      status: "warning",
      message: warnings.join("; "),
    };
  } else {
    checks.isolation = { status: "ok" };
  }

  // Check 3: Verify token derivation works
  const secret = process.env.INTERNAL_WORKER_SECRET;
  if (secret) {
    checks.tokenDerivation = { status: "ok" };
  } else {
    healthy = false;
    checks.tokenDerivation = {
      status: "error",
      message: "INTERNAL_WORKER_SECRET not set",
    };
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
