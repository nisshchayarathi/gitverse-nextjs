import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_BYTE_LENGTH = 32;
const KEY_HEX_LENGTH = KEY_BYTE_LENGTH * 2;
const HEX_REGEX = /^[0-9a-f]+$/i;

export interface EncryptionConfigStatus {
  valid: boolean;
  error?: string;
}

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required for token encryption");
  }
  const trimmed = key.trim();
  if (trimmed.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters (${KEY_BYTE_LENGTH} bytes); got ${trimmed.length} characters`
    );
  }
  if (!HEX_REGEX.test(trimmed)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a hexadecimal string (0-9, a-f)"
    );
  }
  return Buffer.from(trimmed, "hex");
}

export function validateEncryptionConfig(): EncryptionConfigStatus {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || !key.trim()) {
    return { valid: false, error: "TOKEN_ENCRYPTION_KEY is not set" };
  }
  const trimmed = key.trim();
  if (trimmed.length !== KEY_HEX_LENGTH) {
    return {
      valid: false,
      error: `TOKEN_ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters; got ${trimmed.length}`,
    };
  }
  if (!HEX_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "TOKEN_ENCRYPTION_KEY must be a hex string (0-9, a-f)",
    };
  }
  return { valid: true };
}

export function checkEncryptionHealth(): { healthy: boolean; message: string } {
  const config = validateEncryptionConfig();
  if (!config.valid) {
    return { healthy: false, message: config.error! };
  }
  try {
    const testPayload = "health-check-test-payload";
    const encrypted = encryptToken(testPayload);
    const decrypted = decryptToken(encrypted);
    if (decrypted !== testPayload) {
      return { healthy: false, message: "Encrypt/decrypt round-trip failed" };
    }
    return { healthy: true, message: "Encryption is properly configured" };
  } catch (e: any) {
    return { healthy: false, message: `Encryption check failed: ${e.message}` };
  }
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function isTokenEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length > IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}
