import crypto from "crypto";
import { getNextAuthSecret } from "../config/env";

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  return Buffer.from(withPad, "base64").toString("utf8");
}

function getSecret(): string {
  const secret = (
    process.env.GITHUB_APP_STATE_SECRET ||
    getNextAuthSecret()
  ).trim();
  if (!secret) {
    throw new Error(
      "GITHUB_APP_STATE_SECRET (or NEXTAUTH_SECRET) is required for GitHub App install state",
    );
  }
  return secret;
}

export function createSignedState(payload: Record<string, unknown>): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

export function verifySignedState<T extends Record<string, unknown>>(
  state: string,
): { ok: true; payload: T } | { ok: false; error: string } {
  if (!state || !state.includes(".")) {
    return { ok: false, error: "missing_state" };
  }

  const [body, sig] = state.split(".");
  if (!body || !sig) {
    return { ok: false, error: "bad_state" };
  }

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest();

  const actualBuf = Buffer.from(
    sig.replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((sig.length + 3) % 4),
    "base64",
  );

  if (
    actualBuf.length !== expected.length ||
    !crypto.timingSafeEqual(actualBuf, expected)
  ) {
    return { ok: false, error: "invalid_signature" };
  }

  try {
    const json = base64UrlDecodeToString(body);
    const payload = JSON.parse(json);
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "invalid_payload" };
  }
}
