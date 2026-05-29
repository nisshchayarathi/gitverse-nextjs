import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

function loadHexKey(raw: string | undefined, label: string): Buffer {
  if (!raw || !HEX_64_RE.test(raw)) {
    throw new Error(`${label} must be a 64-character hex string (32 bytes)`);
  }
  return Buffer.from(raw, "hex");
}

function getEncryptionKey(): Buffer {
  return loadHexKey(process.env.TOKEN_ENCRYPTION_KEY?.trim(), "TOKEN_ENCRYPTION_KEY");
}

function getPreviousEncryptionKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (!raw) return null;
  return loadHexKey(raw, "TOKEN_ENCRYPTION_KEY_PREVIOUS");
}

function tryDecryptWithKey(ciphertext: string, key: Buffer): string | null {
  try {
    const combined = Buffer.from(ciphertext, "base64");
    if (combined.length < IV_LENGTH + TAG_LENGTH) return null;

    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("Token to encrypt must not be empty");

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString("base64");
}

export function decryptToken(ciphertext: string): string {
  if (!ciphertext) throw new Error("Token to decrypt must not be empty");

  const key = getEncryptionKey();
  const result = tryDecryptWithKey(ciphertext, key);
  if (result !== null) return result;

  const prevKey = getPreviousEncryptionKey();
  if (prevKey) {
    const prevResult = tryDecryptWithKey(ciphertext, prevKey);
    if (prevResult !== null) return prevResult;
  }

  throw new Error("Failed to decrypt token: invalid key or corrupted data");
}
