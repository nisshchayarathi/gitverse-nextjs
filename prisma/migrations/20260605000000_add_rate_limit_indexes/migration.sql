-- Add composite index on (key, expires_at) for rate limit lookups
-- and a named index on expires_at for efficient cleanup queries.
CREATE INDEX IF NOT EXISTS "rate_limits_key_expires_at_idx"
  ON "rate_limits" ("key", "expires_at");

CREATE INDEX IF NOT EXISTS "rate_limits_expires_at_idx"
  ON "rate_limits" ("expires_at");
