import prisma from "@/lib/prisma";
import { encryptToken } from "@/lib/utils/envelopeEncryption";

/**
 * Encrypt-mfa-secrets migration script.
 *
 * Encrypts ALL existing MfaConfig.totpSecret values that are still stored
 * in plaintext (tokenEncrypted = false).  This covers secrets created before
 * application-layer encryption was introduced.
 *
 * Safe to run multiple times — already-encrypted rows are skipped.
 *
 * Usage:
 *   npx tsx scripts/encrypt-mfa-secrets.ts
 */
async function main(): Promise<void> {
  console.log("Scanning for unencrypted MFA secrets...\n");

  const unencrypted = await prisma.mfaConfig.findMany({
    where: { tokenEncrypted: false },
    select: { id: true, userId: true, totpSecret: true },
  });

  if (unencrypted.length === 0) {
    console.log("No unencrypted secrets found — all are already encrypted.");
    return;
  }

  console.log(`Found ${unencrypted.length} unencrypted secret(s).\n`);

  let okCount = 0;
  let failCount = 0;

  for (const row of unencrypted) {
    try {
      const encrypted = await encryptToken(row.totpSecret);
      await prisma.mfaConfig.update({
        where: { id: row.id },
        data: { totpSecret: encrypted, tokenEncrypted: true },
      });
      okCount++;
      process.stdout.write(".");
    } catch (err: any) {
      console.error(`\nFailed to encrypt secret id=${row.id} (userId=${row.userId}): ${err.message}`);
      failCount++;
    }
  }

  console.log("\n");
  console.log("── Summary ──────────────────────────────────────");
  console.log(`  Total unencrypted secrets: ${unencrypted.length}`);
  console.log(`  Successfully encrypted:    ${okCount}`);
  console.log(`  Failed:                    ${failCount}`);

  if (failCount > 0) {
    console.error("\n⚠  Some secrets could not be encrypted. Review the errors above.");
    process.exit(1);
  }

  console.log("\n✅ All MFA secrets are now encrypted at rest.");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
