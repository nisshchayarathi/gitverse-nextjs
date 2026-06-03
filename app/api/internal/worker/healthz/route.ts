import { NextRequest, NextResponse } from "next/server";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import {
  validateRequiredSecrets,
  validateSecretIsolation,
} from "@/lib/utils/internalAuth";
import { checkEncryptionHealth } from "@/lib/utils/tokenEncryption";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isInternalWorkerAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, { status: string; message?: string }> = {};
  let healthy = true;

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

  const warnings = validateSecretIsolation();
  if (warnings.length > 0) {
    checks.isolation = {
      status: "warning",
      message: warnings.join("; "),
    };
  } else {
    checks.isolation = { status: "ok" };
  }

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

  const encryptionHealth = checkEncryptionHealth();
  if (encryptionHealth.healthy) {
    checks.tokenEncryption = { status: "ok" };
  } else {
    healthy = false;
    checks.tokenEncryption = {
      status: "error",
      message: encryptionHealth.message,
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
