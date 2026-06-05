-- Backfill: copy existing model values to new model_version column
ALTER TABLE "gemini_analysis_cache"
  ADD COLUMN "model_version" TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE "gemini_analysis_cache"
  ADD COLUMN "analysis_scope" TEXT NOT NULL DEFAULT 'full';

UPDATE "gemini_analysis_cache"
  SET "model_version" = COALESCE("model", 'unknown')
  WHERE "model" IS NOT NULL;

-- Drop old unique constraint, add new one with modelVersion and analysisScope
ALTER TABLE "gemini_analysis_cache"
  DROP CONSTRAINT "gemini_analysis_cache_repository_id_commit_hash_analysis_type_prompt_hash_key";

ALTER TABLE "gemini_analysis_cache"
  ADD CONSTRAINT "gemini_analysis_cache_repository_id_commit_hash_analysis_type_prompt_hash_model_version_analysis_scope_key"
  UNIQUE ("repository_id", "commit_hash", "analysis_type", "prompt_hash", "model_version", "analysis_scope");

CREATE INDEX IF NOT EXISTS "gemini_analysis_cache_model_version_idx"
  ON "gemini_analysis_cache" ("model_version");
