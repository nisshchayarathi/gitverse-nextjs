-- Add token_encrypted column to mfa_configs if it does not already exist
-- (schema drift recovery for environments that used prisma db push)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mfa_configs'
      AND column_name = 'token_encrypted'
  ) THEN
    ALTER TABLE "mfa_configs"
      ADD COLUMN "token_encrypted" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Mark all rows with a non-null totp_secret as not yet application-encrypted.
-- The application-layer encrypt-mfa-secrets script will flip this flag after
-- re-encrypting each secret. Until then, getDecryptedTotpSecret reads them
-- as plaintext (backward-compatible fallback path).
UPDATE "mfa_configs"
  SET "token_encrypted" = false
  WHERE "totp_secret" IS NOT NULL;
