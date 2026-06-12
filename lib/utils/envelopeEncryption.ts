import crypto from "crypto";
import { getKmsProvider, KmsProvider } from "@/lib/utils/kmsProvider";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    if (isKmsConfigured()) {
      const kms = await ensureKms();
      const keyId = getKmsKeyId();

      // Check database for active key first
      let activeKeyRecord = await prisma.dataEncryptionKey.findFirst({
        where: { isActive: true },
      });

      let activeWrapped = activeKeyRecord?.wrappedKey || null;

      if (!activeWrapped) {
        // Fallback to process.env.WRAPPED_DEK
        activeWrapped = process.env.WRAPPED_DEK || null;

        if (activeWrapped) {
          // Save the env key to the database
          await prisma.dataEncryptionKey.create({
            data: {
              wrappedKey: activeWrapped,
              isActive: true,
            },
          });
        } else {
          // Generate new key and save to database
          const result = await kms.generateDataKey(keyId, "AES_256");
          activeWrapped = result.ciphertext.toString("base64");
          await prisma.dataEncryptionKey.create({
            data: {
              wrappedKey: activeWrapped,
              isActive: true,
            },
          });
        }
      }

      const wrappedBuf = Buffer.from(activeWrapped, "base64");
      const plaintext = await kms.decrypt(keyId, wrappedBuf);
      dekCache = { plaintext, wrapped: activeWrapped };
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

export async function rotateAndReEncryptAll(): Promise<{
  oldWrapped: string | null;
  newWrapped: string;
  githubAccountsCount: number;
  accountsCount: number;
  mfaConfigsCount: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  if (!isKmsConfigured()) {
    throw new Error("KMS must be configured to rotate DEK. Set KMS_KEY_ID and KMS_PROVIDER=aws.");
  }

  // Ensure current DEK is loaded in memory
  await initializeDek();
  if (!dekCache || !dekCache.plaintext) {
    throw new Error("Failed to initialize current DEK");
  }
  const oldPlaintext = dekCache.plaintext;

  const kms = await ensureKms();
  const keyId = getKmsKeyId();

  // Find the active wrapped key in database (to track oldWrapped)
  const activeKeyRecord = await prisma.dataEncryptionKey.findFirst({
    where: { isActive: true },
  });
  const oldWrapped = activeKeyRecord?.wrappedKey ?? dekCache.wrapped;

  logger.info(
    { oldWrapped: oldWrapped ? `${oldWrapped.substring(0, 20)}...` : null },
    "Generating new DEK from AWS KMS..."
  );

  const result = await kms.generateDataKey(keyId, "AES_256");
  const newPlaintext = result.plaintext;
  const newWrapped = result.ciphertext.toString("base64");

  logger.info("Fetching credentials for re-encryption...");

  // Retrieve all records to be re-encrypted
  const githubAccounts = await prisma.gitHubAccount.findMany({
    select: { id: true, accessToken: true, tokenEncrypted: true },
  });

  const accounts = await prisma.account.findMany({
    where: { access_token: { not: null } },
    select: { id: true, access_token: true, tokenEncrypted: true },
  });

  const mfaConfigs = await prisma.mfaConfig.findMany({
    select: { id: true, totpSecret: true, tokenEncrypted: true },
  });

  logger.info(
    {
      githubAccountsCount: githubAccounts.length,
      accountsCount: accounts.length,
      mfaConfigsCount: mfaConfigs.length,
    },
    "Decrypting and re-encrypting credentials in memory..."
  );

  const decryptedLegacyHex = process.env.TOKEN_ENCRYPTION_KEY;
  const legacyKey = decryptedLegacyHex ? Buffer.from(decryptedLegacyHex.trim(), "hex") : null;

  const decryptValue = (val: string): string => {
    try {
      return aesDecrypt(val, oldPlaintext);
    } catch (err) {
      if (legacyKey && legacyKey.length === DEK_BYTE_LENGTH) {
        try {
          return aesDecrypt(val, legacyKey);
        } catch {}
      }
      throw new Error(`Failed to decrypt credential with current DEK and legacy key: ${err}`);
    }
  };

  const reEncryptedGithubAccounts = githubAccounts.map((item: { id: number; accessToken: string; tokenEncrypted: boolean }) => {
    const plain = item.tokenEncrypted ? decryptValue(item.accessToken) : item.accessToken;
    return {
      id: item.id,
      encrypted: aesEncrypt(plain, newPlaintext),
    };
  });

  const reEncryptedAccounts = accounts.map((item: { id: string; access_token: string | null; tokenEncrypted: boolean }) => {
    const plain = item.tokenEncrypted ? decryptValue(item.access_token!) : item.access_token!;
    return {
      id: item.id,
      encrypted: aesEncrypt(plain, newPlaintext),
    };
  });

  const reEncryptedMfaConfigs = mfaConfigs.map((item: { id: number; totpSecret: string; tokenEncrypted: boolean }) => {
    const plain = item.tokenEncrypted ? decryptValue(item.totpSecret) : item.totpSecret;
    return {
      id: item.id,
      encrypted: aesEncrypt(plain, newPlaintext),
    };
  });

  logger.info("Executing database transaction for DEK rotation...");

  await prisma.$transaction(async (tx) => {
    // 1. Mark existing active DEKs as inactive
    await tx.dataEncryptionKey.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // 2. Create the new active DEK
    await tx.dataEncryptionKey.create({
      data: {
        wrappedKey: newWrapped,
        isActive: true,
      },
    });

    // 3. Update all database records
    for (const update of reEncryptedGithubAccounts) {
      await tx.gitHubAccount.update({
        where: { id: update.id },
        data: { accessToken: update.encrypted, tokenEncrypted: true },
      });
    }

    for (const update of reEncryptedAccounts) {
      await tx.account.update({
        where: { id: update.id },
        data: { access_token: update.encrypted, tokenEncrypted: true },
      });
    }

    for (const update of reEncryptedMfaConfigs) {
      await tx.mfaConfig.update({
        where: { id: update.id },
        data: { totpSecret: update.encrypted, tokenEncrypted: true },
      });
    }
  });

  // Update in-memory cache
  dekCache = { plaintext: newPlaintext, wrapped: newWrapped };
  const durationMs = Date.now() - startTime;

  logger.info(
    {
      newWrapped: `${newWrapped.substring(0, 20)}...`,
      githubAccountsCount: reEncryptedGithubAccounts.length,
      accountsCount: reEncryptedAccounts.length,
      mfaConfigsCount: reEncryptedMfaConfigs.length,
      durationMs,
    },
    "DEK rotation and database re-encryption completed successfully."
  );

  return {
    oldWrapped,
    newWrapped,
    githubAccountsCount: reEncryptedGithubAccounts.length,
    accountsCount: reEncryptedAccounts.length,
    mfaConfigsCount: reEncryptedMfaConfigs.length,
    durationMs,
  };
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
