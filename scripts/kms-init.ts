import { getKmsProvider } from "../lib/utils/kmsProvider";

async function main() {
  console.log("🔐 Initializing KMS Envelope Encryption...\n");

  const keyId = process.env.KMS_KEY_ID;
  if (!keyId) {
    console.error("❌ KMS_KEY_ID environment variable is required.");
    console.log("   Set it to your AWS KMS key ARN, e.g.:");
    console.log('   KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/abc123def-...');
    process.exit(1);
  }

  try {
    const kms = getKmsProvider();
    const result = await kms.generateDataKey(keyId, "AES_256");
    const wrapped = result.ciphertext.toString("base64");

    console.log("✅ New Data Encryption Key generated and wrapped via KMS.");
    console.log(`   KMS Key ID:   ${keyId}`);
    console.log(`   WRAPPED_DEK="${wrapped}"`);
    console.log("\n⚠️  Add this to your environment variables and restart all services.\n");
  } catch (e: any) {
    console.error("❌ KMS initialization failed:", e.message);
    process.exit(1);
  }
}

main();
