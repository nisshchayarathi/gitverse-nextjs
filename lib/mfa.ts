/**
 * TOTP-based Multi-Factor Authentication (MFA) Utility
 *
 * Implements Time-based One-Time Passwords (RFC 6238) using the Web Crypto API.
 * No external TOTP library required — zero additional dependencies.
 *
 * Features:
 *   - TOTP secret generation (Base32)
 *   - QR code URI generation (otpauth://)
 *   - TOTP token verification (30-second window ±1 step for clock skew)
 *   - Cryptographically-secure backup code generation
 */

import { createHmac, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/utils/envelopeEncryption";

// ─── Base32 Encoding ────────────────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a Buffer as a Base32 string (RFC 4648).
 */
export function base32Encode(buffer: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Decodes a Base32 string back to a Buffer.
 */
export function base32Decode(input: string): Buffer {
  const str = input.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ─── TOTP Core ──────────────────────────────────────────────────────────────

const TOTP_STEP = 30; // seconds per time step
const TOTP_DIGITS = 6; // standard 6-digit token
const TOTP_WINDOW = 1; // ±1 step tolerance for clock skew

/**
 * Generates a TOTP token for the given secret and time counter.
 */
function generateHOTP(secret: Buffer, counter: number): string {
  // Pack counter as big-endian 8-byte buffer
  const counterBuffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuffer.writeUInt32BE(high, 0);
  counterBuffer.writeUInt32BE(low, 4);

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

/**
 * Generates a TOTP token for a given Base32 secret and timestamp.
 */
export function generateTOTP(
  base32Secret: string,
  timestamp = Date.now(),
): string {
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(timestamp / 1000 / TOTP_STEP);
  return generateHOTP(secret, counter);
}

/**
 * Verifies a user-supplied TOTP token against the secret.
 * Checks ±TOTP_WINDOW time steps to account for clock skew.
 */
export function verifyTOTP(
  base32Secret: string,
  token: string,
  timestamp = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const secret = base32Decode(base32Secret);
  const counter = Math.floor(timestamp / 1000 / TOTP_STEP);

  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const expected = generateHOTP(secret, counter + delta);
    if (timingSafeEqual(expected, token)) return true;
  }

  return false;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Secret Generation ──────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure 20-byte TOTP secret (160-bit).
 */
export function generateTOTPSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Builds an otpauth:// URI for QR code generation.
 * Compatible with Google Authenticator, Authy, and 1Password.
 */
export function buildOtpAuthUri(
  secret: string,
  userEmail: string,
  issuer = "GitVerse",
): string {
  const label = encodeURIComponent(`${issuer}:${userEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── Backup Codes ───────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 10;

/**
 * Generates a set of cryptographically secure alphanumeric backup codes.
 * Returns the plaintext codes (shown to user once) and a comma-separated
 * list of SHA-256 hashes for storage.
 */
export function generateBackupCodes(): { plaintext: string[]; hashed: string } {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous 0/O, 1/I
  const codes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = randomBytes(BACKUP_CODE_LENGTH);
    const code = Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join("")
      .replace(/(.{5})/g, "$1-")
      .slice(0, -1); // Format: XXXXX-XXXXX
    codes.push(code);
  }

  // Hash codes for storage (plain SHA-256; bcrypt would be too slow for 8 codes)
  const { createHash } = require("crypto");
  const hashed = codes
    .map((c) => createHash("sha256").update(c.replace(/-/g, "")).digest("hex"))
    .join(",");

  return { plaintext: codes, hashed };
}

/**
 * Verifies a backup code against stored hashes and invalidates it on success
 * (one-time use).
 */
export async function verifyAndConsumeBackupCode(
  userId: number,
  suppliedCode: string,
): Promise<boolean> {
  const { createHash } = require("crypto");

  const mfaConfig = await prisma.mfaConfig.findUnique({
    where: { userId },
    select: { id: true, backupCodes: true },
  });

  if (!mfaConfig?.backupCodes) return false;

  const normalizedCode = suppliedCode.replace(/-/g, "").toUpperCase();
  const suppliedHash = createHash("sha256")
    .update(normalizedCode)
    .digest("hex");
  const storedHashes = mfaConfig.backupCodes.split(",");
  const idx = storedHashes.indexOf(suppliedHash);

  if (idx < 0) return false;

  // Remove the used code (one-time use)
  storedHashes.splice(idx, 1);
  await prisma.mfaConfig.update({
    where: { id: mfaConfig.id },
    data: { backupCodes: storedHashes.join(",") || null },
  });

  return true;
}

// ─── Database Helpers ────────────────────────────────────────────────────────

/**
 * Retrieves MFA enabled status for a user.
 *
 * This function intentionally selects only the `isEnabled` boolean column
 * rather than the entire row.  Previously it fetched `totpSecret` as well
 * to derive a `hasSecret` flag, but that leaked the encrypted secret bytes
 * over the wire even when only the boolean was needed by the caller.
 *
 * @param userId  The user whose MFA status to check.
 * @returns `{ isEnabled: boolean }` — never includes the secret.
 *          Returns `{ isEnabled: false }` when no MfaConfig row exists
 *          (convenience: caller does not need a separate null check for the
 *          common case of "user has never set up MFA").
 */
export async function getMfaStatus(
  userId: number,
): Promise<{ isEnabled: boolean } | null> {
  const config = await prisma.mfaConfig.findUnique({
    where: { userId },
    select: { isEnabled: true },
  });

  if (!config) return { isEnabled: false };
  return { isEnabled: config.isEnabled };
}

/**
 * Creates or replaces the TOTP secret for a user (pre-enrollment, not yet enabled).
 *
 * Encryption happens BEFORE the upsert — the plaintext secret never touches
 * the database.  Uses `encryptToken` from the envelope-encryption layer
 * (AES-256-GCM with IV + auth tag prepended as a single base64 blob).
 *
 * @param userId      The user to associate this config with.
 * @param totpSecret  The Base32-encoded plaintext TOTP secret. It is
 *                    encrypted synchronously before the database write.
 *
 * Security notes:
 *   - `tokenEncrypted` is always set to `true` on write.  Rows written
 *     before this field existed (or with `default(false)`) are detected
 *     by `getDecryptedTotpSecret` which falls back to plaintext read.
 *   - The plaintext `totpSecret` parameter is transient — it lives in the
 *     calling route handler's memory and should not be logged or persisted.
 */
export async function upsertMfaSecret(
  userId: number,
  totpSecret: string,
): Promise<void> {
  const encrypted = await encryptToken(totpSecret);
  await prisma.mfaConfig.upsert({
    where: { userId },
    create: { userId, totpSecret: encrypted, tokenEncrypted: true, isEnabled: false },
    update: { totpSecret: encrypted, tokenEncrypted: true, isEnabled: false },
  });
}

/**
 * Reads the TOTP secret for a user and decrypts it if necessary.
 *
 * This is the single point of decryption for all MFA routes.  Previously
 * each route (setup DELETE, verify POST) had its own inline decrypt logic
 * that checked `tokenEncrypted` and called `decryptToken` directly.  That
 * duplication risked one route falling out of sync with the others.
 *
 * Decryption strategy:
 *   1. If `tokenEncrypted` is `true`, decrypt via `decryptToken` (envelope
 *      encryption: AES-256-GCM with the current DEK).
 *   2. If `tokenEncrypted` is `false`, return the stored value as-is.
 *      This covers legacy rows that were written before application-layer
 *      encryption was introduced.  The migration script
 *      `scripts/encrypt-mfa-secrets.ts` should be run to flip these.
 *
 * @param userId  The user whose secret to retrieve.
 * @returns The plaintext Base32 TOTP secret, or `null` if no config or
 *          no stored secret exists.
 */
export async function getDecryptedTotpSecret(userId: number): Promise<string | null> {
  const config = await prisma.mfaConfig.findUnique({
    where: { userId },
    select: { totpSecret: true, tokenEncrypted: true },
  });
  if (!config?.totpSecret) return null;
  if (config.tokenEncrypted) return await decryptToken(config.totpSecret);
  return config.totpSecret;
}

/**
 * Activates MFA for a user after verifying their first TOTP token.
 *
 * Sets `isEnabled` to `true`, stores the hashed backup codes, and records
 * `lastVerifiedAt` as the current timestamp.  The TOTP secret is already
 * in the database from the earlier `upsertMfaSecret` call during the setup
 * flow — this function only flips the enabled flag and stores the codes.
 *
 * @param userId            The user whose MFA to activate.
 * @param hashedBackupCodes Comma-separated SHA-256 hashes of backup codes.
 *                          These are stored at-rest in plain SHA-256 format
 *                          (not bcrypt) because verifying 8+ backup codes
 *                          at once would be prohibitively slow with bcrypt.
 */
export async function enableMfa(
  userId: number,
  hashedBackupCodes: string,
): Promise<void> {
  await prisma.mfaConfig.update({
    where: { userId },
    data: {
      isEnabled: true,
      backupCodes: hashedBackupCodes,
      lastVerifiedAt: new Date(),
    },
  });
}

/**
 * Disables and removes MFA for a user.
 *
 * Deletes the entire `MfaConfig` row, including the encrypted TOTP secret
 * and all backup code hashes.  This is a hard delete (not a soft-disable)
 * because there is no use case for re-activating a previously disabled MFA
 * configuration with the same secret.
 *
 * Uses `deleteMany` (not `delete`) because Prisma's `delete` requires the
 * row to exist, whereas `deleteMany` silently succeeds when the row is
 * already gone — avoiding a race-condition error if two requests arrive
 * simultaneously.
 *
 * @param userId  The user whose MFA configuration to remove.
 */
export async function disableMfa(userId: number): Promise<void> {
  await prisma.mfaConfig.deleteMany({ where: { userId } });
}
