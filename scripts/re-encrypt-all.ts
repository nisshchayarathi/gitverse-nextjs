import prisma from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/utils/envelopeEncryption";

/**
 * Re-encrypt-all migration script.
 *
 * Re-encrypts ALL MfaConfig.totpSecret values using the current DEK.
 * Useful after a DEK rotation so that all secrets are protected by the
 * newest key.
 *
 * Usage:
 *   npx tsx scripts/re-encrypt-all.ts
 *
 * Prerequisites:
 *   - The environment must have the NEW key configured (TOKEN_ENCRYPTION_KEY
 *     or a KMS-wrapped DEK via WRAPPED_DEK).
 *   - The OLD key must be set as TOKEN_ENCRYPTION_KEY if secrets were
 *     previously encrypted with a local key (the script falls back to it).
 *
 * Idempotent: re-running re-encrypts already-re-encrypted values (they
 * remain decryptable with the current key, so this is safe but wasteful).
 */
async function main(): Promise<void> {
  console.log("Re-encrypting all MFA secrets with the current DEK...\n");

  const allSecrets = await prisma.mfaConfig.findMany({
    where: { totpSecret: { not: null as any } },
    select: { id: true, userId: true, totpSecret: true, tokenEncrypted: true },
  });

  if (allSecrets.length === 0) {
    console.log("No MFA configs found. Nothing to do.");
    return;
  }

  console.log(`Found ${allSecrets.length} MFA config(s).\n`);

  const oldKeyHex = process.env.TOKEN_ENCRYPTION_KEY;
  const oldKey = oldKeyHex ? Buffer.from(oldKeyHex.trim(), "hex") : null;
  if (oldKey && oldKey.length !== 32) {
    console.error("TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
    process.exit(1);
  }

  let reEncrypted = 0;
  let skipped = 0;
  let failed = 0;

  // We import the private aesDecrypt/aesEncrypt via the public API:
  //   decryptToken(ciphertext) -> plaintext
  //   encryptToken(plaintext) -> newCiphertext
  for (const row of allSecrets) {
    try {
      let plaintext: string;

      if (row.tokenEncrypted) {
        // Already encrypted — decrypt with the current or old key
        try {
          plaintext = await decryptToken(row.totpSecret);
        } catch {
          // decryptToken already falls back to TOKEN_ENCRYPTION_KEY
          console.error(`Cannot decrypt id=${row.id} — skipping.`);
          failed++;
          continue;
        }
      } else {
        // Plaintext — use as-is
        plaintext = row.totpSecret;
      }

      const encrypted = await encryptToken(plaintext);
      await prisma.mfaConfig.update({
        where: { id: row.id },
        data: { totpSecret: encrypted, tokenEncrypted: true },
      });
      reEncrypted++;
      process.stdout.write(".");
    } catch (err: any) {
      console.error(`\nFailed id=${row.id} (userId=${row.userId}): ${err.message}`);
      failed++;
    }
  }

  console.log("\n");
  console.log("── Summary ──────────────────────────────────────");
  console.log(`  Total MFA configs:    ${allSecrets.length}`);
  console.log(`  Re-encrypted:         ${reEncrypted}`);
  console.log(`  Skipped (no change):  ${skipped}`);
  console.log(`  Failed:               ${failed}`);

  if (failed > 0) {
    console.error("\n⚠  Some secrets could not be re-encrypted.");
    process.exit(1);
  }

  console.log("\n✅ All MFA secrets re-encrypted with the current DEK.");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
