-- Add token_version column to users table for JWT revocation support.
-- Tokens carry the user's current token_version; when it is incremented
-- (e.g. on logout or password change) all previously issued tokens become
-- invalid regardless of their expiration date.

ALTER TABLE "users"
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
