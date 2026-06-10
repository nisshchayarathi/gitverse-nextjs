import { rotateDek } from "../lib/utils/envelopeEncryption";

async function main() {
  console.log("🔐 Rotating Data Encryption Key...\n");

  try {
    const result = await rotateDek();
    console.log("✅ New DEK generated and wrapped via KMS.");
    console.log(`   Previous wrapped DEK: ${result.oldWrapped ? result.oldWrapped.substring(0, 40) + "..." : "none"}`);
    console.log(`   New wrapped DEK:      ${result.newWrapped.substring(0, 40)}...`);
    console.log("\n⚠️  IMPORTANT: Update your environment variables:");
    console.log(`   WRAPPED_DEK="${result.newWrapped}"`);
    console.log("\n   The old wrapped DEK is no longer valid.");
    console.log("   All new encryption operations will use the new DEK.");
    console.log("\n   To re-encrypt existing data with the new DEK, run:");
    console.log("   npm run re-encrypt\n");
  } catch (e: any) {
    console.error("❌ DEK rotation failed:", e.message);
    process.exit(1);
  }
}

main();
