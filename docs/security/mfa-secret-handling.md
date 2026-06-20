# MFA Secret Handling

## Overview

TOTP secrets (`MfaConfig.totpSecret`) are **encrypted at rest** using the same envelope-encryption mechanism that protects OAuth tokens and other credentials.  This document describes the encryption architecture, the migration path for existing secrets, and operational considerations for maintainers.

## Encryption Architecture

| Layer | Mechanism | Key Material |
|-------|-----------|--------------|
| Data Encryption Key (DEK) | AES-256-GCM, random per encryption | 256-bit key derived from `TOKEN_ENCRYPTION_KEY` env var or KMS-wrapped DEK |
| Key Encryption Key (KEK) | AWS KMS `kms:GenerateDataKey` / `kms:Decrypt` (optional) | `KMS_KEY_ID` - ARN of the KMS key |
| Fallback | `TOKEN_ENCRYPTION_KEY` env var when KMS is not configured | 64-character hex string → 256-bit key |

### Encryption Flow

1. `upsertMfaSecret(userId, plaintextSecret)` in `lib/mfa.ts`
2. Calls `encryptToken(plaintextSecret)` from `lib/utils/envelopeEncryption.ts`
3. `encryptToken` obtains the current DEK (from cache, KMS, or env var)
4. AES-256-GCM encrypts the secret with a random 16-byte IV
5. Result: `base64(iv + authTag + ciphertext)` stored in `mfa_configs.totp_secret`
6. `mfa_configs.token_encrypted` is set to `true`

### Decryption Flow

1. `getDecryptedTotpSecret(userId)` in `lib/mfa.ts`
2. Reads `totp_secret` and `token_encrypted` from the database
3. If `token_encrypted` is `true`, calls `decryptToken(ciphertext)` → AES-256-GCM decrypt
4. If `token_encrypted` is `false`, returns the stored value as-is (plaintext fallback)

### Envelope Encryption Module

All crypto primitives live in `lib/utils/envelopeEncryption.ts`.  See doc comments there for details about key rotation, health checks, and KMS vs. local-key modes.

## API Endpoints

### `POST /api/auth/mfa/setup`

Returns the plaintext `secret` in the response body so the client can render a QR code or let the user enter it manually.  **This is the only time the plaintext secret leaves the server.**  The application immediately encrypts and persists it before responding.

> **⚠  IMPORTANT: Do NOT log the response body of this endpoint.**
> The `secret` field contains the Base32-encoded TOTP secret in plaintext.
> If this response is logged (e.g., via middleware, CloudWatch, or structured
> logging), the secret is exposed to anyone with log access.  Ensure your
> logging infrastructure redacts the response body for this endpoint.

### `POST /api/auth/mfa/verify`

- Reads the encrypted secret from the database using `getDecryptedTotpSecret`
- Decrypts it in-memory only long enough to verify the user's TOTP token or backup code
- **Never** returns the secret in any response

### `DELETE /api/auth/mfa/setup`

- Decrypts the stored secret to confirm the user's identity via TOTP
- On success, deletes the row entirely
- **Never** returns the secret in any response

## Database

| Column | Type | Description |
|--------|------|-------------|
| `totp_secret` | `Text` | Base64-encoded ciphertext (AES-256-GCM) or legacy Base32 plaintext |
| `token_encrypted` | `Boolean` | `true` once application-layer encryption has been applied |
| `is_enabled` | `Boolean` | Whether MFA is fully active for this user |
| `backup_codes` | `Text` | Comma-separated bcrypt hashes of one-time backup codes |

### Schema Drift Note

The `token_encrypted` column on `mfa_configs` was introduced before a formal migration was tracked.  The migration `20260606000001_encrypt_mfa_secrets/migration.sql` handles both adding the column (if missing) and marking existing rows as `token_encrypted = false`.

## Migration

### For existing (plaintext) secrets

Run the migration script after deploying the encryption code:

```bash
npx tsx scripts/encrypt-mfa-secrets.ts
```

This script:
1. Finds all rows where `token_encrypted = false`
2. Encrypts `totp_secret` using the current DEK
3. Updates each row with the ciphertext and sets `token_encrypted = true`

The migration is idempotent — running it again after completion is a no-op.

### For new deployments

New secrets are always encrypted before storage (`upsertMfaSecret` in `lib/mfa.ts` sets `tokenEncrypted: true` on every upsert).  No additional steps needed.

## Testing

### Integration Tests

- `app/api/auth/mfa/setup/__tests__/route.test.ts` — verifies setup and disable flows
- `app/api/auth/mfa/verify/__tests__/route.test.ts` — verifies enrollment, authentication, backup codes, and status

Encryption/decryption logic in `lib/mfa.ts` (`upsertMfaSecret` / `getDecryptedTotpSecret`) delegates to `encryptToken` / `decryptToken` from the envelope encryption module.  Unit-level encryption tests should be added alongside that module.

### Writing New Tests

When adding or modifying MFA tests:
1. **Mock `getDecryptedTotpSecret`** in route tests to return a known plaintext secret (the mock replaces the actual decrypt call)
2. **Do NOT mock the actual decrypt path** in tests for `lib/mfa.ts` — test the real encrypt/decrypt round-trip there
3. **Test both paths**: `tokenEncrypted: true` (encrypted) and `tokenEncrypted: false` (plaintext fallback)

## Key Rotation

Use the existing key rotation infrastructure:

```bash
# Rotate the DEK (requires KMS)
npx tsx scripts/rotate-dek.ts

# The new WRAPPED_DEK must be deployed.  There is no automated
# re-encryption of existing secrets yet; file an issue if needed.
```

The `reEncryptWithNewDek` function in `envelopeEncryption.ts` can be adapted for MFA secrets when a full re-encryption sweep is required.

## Operational Security Notes

1. **Never log the secret.**  The `POST /api/auth/mfa/setup` response contains the plaintext secret.  Ensure your logging infrastructure (CloudWatch, DataDog, etc.) does not capture response bodies for this endpoint.
2. **Never return the secret after initial setup.**  `GET /api/auth/mfa/verify` and `POST /api/auth/mfa/verify` do not include the secret in their responses.
3. **Backup codes are hashed.**  `MfaConfig.backupCodes` stores bcrypt hashes, not plaintext codes.
4. **Rate limiting protects against brute-force.**  Both `mfa:setup` and `mfa:verify` endpoints have independent rate limit quotas.
5. **Review log access regularly.**  Anyone with log read access can potentially see response bodies if logging is misconfigured.  Audit log access monthly.
