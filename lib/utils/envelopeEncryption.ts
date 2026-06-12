import crypto from "crypto";
import { getKmsProvider, KmsProvider } from "@/lib/utils/kmsProvider";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const DEK_BYTE_LENGTH = 32;

let dekCache: { plaintext: Buffer; wrapped: string | null } | null = null;
let dekPromise: Promise<void> | null = null;
let kmsProvider: KmsProvider | null = null;

export function isKmsConfigured(): boolean {
  return !!(process.env.KMS_KEY_ID || process.env.KMS_PROVIDER === "aws");
}

function getKmsKeyId(): string {
  const keyId = process.env.KMS_KEY_ID;
  if (!keyId) throw new Error("KMS_KEY_ID environment variable is required");
  return keyId;
}

async function ensureKms(): Promise<KmsProvider> {
  if (!kmsProvider) {
    kmsProvider = getKmsProvider();
  }
  return kmsProvider;
}

async function initializeDek(): Promise<void> {
  if (dekCache) return;
  if (dekPromise) return dekPromise;

  dekPromise = (async () => {
    const wrapped = process.env.WRAPPED_DEK || null;

    if (isKmsConfigured()) {
      const kms = await ensureKms();
      const keyId = getKmsKeyId();

      if (wrapped) {
        const wrappedBuf = Buffer.from(wrapped, "base64");
        const plaintext = await kms.decrypt(keyId, wrappedBuf);
        dekCache = { plaintext, wrapped };
      } else {
        const result = await kms.generateDataKey(keyId, "AES_256");
        dekCache = {
          plaintext: result.plaintext,
          wrapped: result.ciphertext.toString("base64"),
        };
      }
    } else {
      const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
      if (!keyHex) throw new Error("TOKEN_ENCRYPTION_KEY is required when KMS is not configured");
      const key = Buffer.from(keyHex.trim(), "hex");
      if (key.length !== DEK_BYTE_LENGTH) {
        throw new Error(`TOKEN_ENCRYPTION_KEY must be ${DEK_BYTE_LENGTH * 2} hex characters`);
      }
      dekCache = { plaintext: key, wrapped: null };
    }
  })();

  await dekPromise;
}

async function getDek(): Promise<Buffer> {
  await initializeDek();
  return dekCache!.plaintext;
}

export function getWrappedDek(): string | null {
  return dekCache?.wrapped ?? null;
}

function aesEncrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function aesDecrypt(ciphertext: string, key: Buffer): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export async function encryptToken(plaintext: string): Promise<string> {
  const dek = await getDek();
  return aesEncrypt(plaintext, dek);
}

export async function decryptToken(ciphertext: string): Promise<string> {
  try {
    const dek = await getDek();
    return aesDecrypt(ciphertext, dek);
  } catch {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (keyHex) {
      const key = Buffer.from(keyHex.trim(), "hex");
      if (key.length === DEK_BYTE_LENGTH) {
        try {
          return aesDecrypt(ciphertext, key);
        } catch {}
      }
    }
    throw new Error("Failed to decrypt token with all available keys");
  }
}

export function isTokenEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length > IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}

export async function rotateDek(): Promise<{ oldWrapped: string | null; newWrapped: string }> {
  if (!isKmsConfigured()) {
    throw new Error("KMS must be configured to rotate DEK. Set KMS_KEY_ID and KMS_PROVIDER=aws.");
  }

  const kms = await ensureKms();
  const keyId = getKmsKeyId();
  const oldWrapped = dekCache?.wrapped ?? null;

  const result = await kms.generateDataKey(keyId, "AES_256");
  const newPlaintext = result.plaintext;
  const newWrapped = result.ciphertext.toString("base64");

  dekCache = { plaintext: newPlaintext, wrapped: newWrapped };

  return { oldWrapped, newWrapped };
}

export async function reEncryptWithNewDek<T extends { id: any; encryptedFields: string[] }>(
  items: T[],
  getEncryptedValue: (item: T, field: string) => string | null | undefined,
  setEncryptedValue: (item: T, field: string, newValue: string) => void,
): Promise<number> {
  const oldKeyHex = process.env.TOKEN_ENCRYPTION_KEY;
  const oldKey = oldKeyHex ? Buffer.from(oldKeyHex.trim(), "hex") : null;
  if (oldKey && oldKey.length !== DEK_BYTE_LENGTH) throw new Error("Invalid legacy key length");

  const newDek = await getDek();
  let reEncrypted = 0;

  for (const item of items) {
    for (const field of item.encryptedFields) {
      const val = getEncryptedValue(item, field);
      if (!val) continue;

      let plaintext: string;
      try {
        plaintext = aesDecrypt(val, newDek);
        continue;
      } catch {
        try {
          if (oldKey) {
            plaintext = aesDecrypt(val, oldKey);
          } else {
            continue;
          }
        } catch {
          continue;
        }
      }

      const reEncryptedValue = aesEncrypt(plaintext, newDek);
      setEncryptedValue(item, field, reEncryptedValue);
      reEncrypted++;
    }
  }

  return reEncrypted;
}

export async function checkEncryptionHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    await initializeDek();
    const testPayload = "health-check-test-payload";
    const encrypted = await encryptToken(testPayload);
    const decrypted = await decryptToken(encrypted);
    if (decrypted !== testPayload) {
      return { healthy: false, message: "Encrypt/decrypt round-trip failed" };
    }
    const mode = isKmsConfigured() ? "KMS envelope encryption" : "local key encryption";
    return { healthy: true, message: `Encryption is healthy (${mode})` };
  } catch (e: any) {
    return { healthy: false, message: `Encryption check failed: ${e.message}` };
  }
}
