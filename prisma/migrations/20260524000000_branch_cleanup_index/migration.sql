-- Add an index on repository_id to speed up the stale-branch cleanup query
-- (DELETE FROM branches WHERE repository_id = ? AND name NOT IN (?)).
-- The unique index branches_repository_id_name_key already covers lookups
-- by (repository_id, name), but a plain index on repository_id alone
-- ensures the delete scan is efficient when the NOT IN list is large.
CREATE INDEX IF NOT EXISTS "branches_repository_id_idx"
ON "branches"("repository_id");
