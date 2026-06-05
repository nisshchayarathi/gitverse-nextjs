import crypto from "crypto";

export function verifyIncidentWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string | undefined;
}): boolean {
  const { rawBody, signatureHeader, webhookSecret } = params;
  const secret = webhookSecret?.trim();

  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function parseIncidentTarget(searchParams: URLSearchParams):
  | { installationId: number; owner: string; repo: string }
  | null {
  const installationId = Number(searchParams.get("installationId"));
  const owner = (searchParams.get("owner") || "").trim();
  const repo = (searchParams.get("repo") || "").trim();

  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return null;
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }

  return { installationId, owner, repo };
}
