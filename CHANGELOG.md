# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- Initial changelog created
- Real `pg_dump`-based database backup endpoint at `GET /api/cron/db-backup`
- `lib/services/backupService.ts` — pg_dump execution, gzip compression, optional S3 upload, retention cleanup
- `docs/infrastructure/database-backup.md` — backup architecture documentation with env var reference, restore procedure, and production considerations
- Cron schedule for db-backup in `vercel.json` (daily at 06:00 UTC)
- Environment variable documentation for backup in `.env.example`
- Migration script `scripts/encrypt-mfa-secrets.ts` to encrypt existing plaintext TOTP secrets at rest
- Migration script `scripts/re-encrypt-all.ts` to rotate encryption for all MFA secrets after DEK rotation
- Migration `20260606000001_encrypt_mfa_secrets` to add `token_encrypted` column to `mfa_configs` (handles existing schema drift)
- Architecture documentation `docs/security/mfa-secret-handling.md`

### Changed
- Refactored `getMfaStatus` in `lib/mfa.ts` to no longer select `totpSecret` from the database (reduces unnecessary data exposure)
- Refactored `DELETE /api/auth/mfa/setup` to use `getDecryptedTotpSecret` instead of inline decrypt logic (reduces code duplication)
- Refactored `POST /api/auth/mfa/verify` to use `getDecryptedTotpSecret` instead of inline decrypt logic (reduces code duplication)

### Deprecated

### Removed
- Removed unused `decryptToken` import from `app/api/auth/mfa/setup/route.ts`

### Fixed
- `getMfaStatus` no longer fetches sensitive `totpSecret` field from database when only `isEnabled` is needed
- TOCTOU race condition in checkRateLimit — replaced non-atomic count-then-create with atomic upsert on a @@unique([key, expiresAt]) constraint
- P2002 catch block is no longer dead code; it enforces limits under concurrent writes
- Switched from sliding-window per-request entries to fixed-window single-entry upsert for atomicity

### Security
- Added operational security documentation for MFA secret handling (log redaction, response body exposure, access control)
- MFA secrets are now always encrypted via `upsertMfaSecret` (envelope encryption, AES-256-GCM) before storage
- The `secret` field returned by `POST /api/auth/mfa/setup` is now documented with a **DO NOT LOG** warning in the security docs
