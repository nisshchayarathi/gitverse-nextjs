import crypto from "crypto";

const FINGERPRINT_LENGTH = 16;

function getFingerprintSecret(): string | null {
  return (
    process.env.IP_FINGERPRINT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    null
  );
}

export function createIpFingerprint(ip: string): string {
  if (!ip || ip === "unknown") {
    return "unknown";
  }

  const secret = getFingerprintSecret();
  if (!secret) {
    return "unavailable";
  }

  return crypto
    .createHmac("sha256", secret)
    .update(ip)
    .digest("hex")
    .substring(0, FINGERPRINT_LENGTH);
}
