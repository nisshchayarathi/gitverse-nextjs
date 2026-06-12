import crypto from "crypto";

const KEY_PREFIX = "gv_";
const KEY_BYTES = 32;

export function generateApiKey(): { raw: string; hashed: string } {
  const raw = KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString("hex");
  const hashed = hashApiKey(raw);
  return { raw, hashed };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function extractBearerToken(authorization: string | null): string | null {
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export function generateKeyExpiry(days: number = 365): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export type ScopedPermission = "repo:read" | "repo:analyze" | "ai:chat" | "user:read";
