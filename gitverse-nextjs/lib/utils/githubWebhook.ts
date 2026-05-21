import crypto from "crypto";

export function verifyGitHubWebhookSignature(params: {
  rawBody: string;
  signature256Header: string | null;
  webhookSecret: string;
}): boolean {
  const { rawBody, signature256Header, webhookSecret } = params;
  if (!webhookSecret?.trim()) return false;
  if (!signature256Header?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  try {
    // timingSafeEqual requires same-length buffers
    const a = Buffer.from(expected);
    const b = Buffer.from(signature256Header);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
