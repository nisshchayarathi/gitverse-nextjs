-- Replace the composite index on (key, expires_at) with a unique constraint
-- so that prisma.rateLimit.upsert can atomically increment points instead of
-- using the non-atomic count-then-create pattern (TOCTOU race condition).
--
-- The old code created a new row per request (sliding window).  The new code
-- creates one row per (key, window_start) and uses UPDATE points += 1.
-- Existing data with duplicate (key, expires_at) rows must be merged first.

-- Step 1: Merge any duplicate (key, expires_at) rows by summing their points
-- into the oldest surviving row for each group.
UPDATE "rate_limits" r
SET "points" = (
  SELECT SUM(r2."points")
  FROM "rate_limits" r2
  WHERE r2."key" = r."key" AND r2."expires_at" = r."expires_at"
)
WHERE r."id" IN (
  SELECT MIN(r3."id")
  FROM "rate_limits" r3
  GROUP BY r3."key", r3."expires_at"
  HAVING COUNT(*) > 1
);

-- Step 2: Delete all but the first (oldest) row per (key, expires_at).
DELETE FROM "rate_limits"
WHERE "id" NOT IN (
  SELECT MIN(r4."id")
  FROM "rate_limits" r4
  GROUP BY r4."key", r4."expires_at"
);

-- Step 3: Drop the old composite index that allowed duplicates.
DROP INDEX IF EXISTS "rate_limits_key_expires_at_idx";

-- Step 4: Add a unique constraint on (key, expires_at).
-- Prisma names this rate_limits_key_expires_at_key following its convention.
ALTER TABLE "rate_limits"
ADD CONSTRAINT "rate_limits_key_expires_at_key" UNIQUE ("key", "expires_at");
