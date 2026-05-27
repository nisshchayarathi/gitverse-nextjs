-- Cache Gemini AI analysis results per repository + commit hash to reduce latency and API costs.

CREATE TABLE "gemini_analysis_cache" (
  "id" SERIAL PRIMARY KEY,
  "repository_id" INTEGER NOT NULL,
  "commit_hash" TEXT NOT NULL,
  "analysis_type" TEXT NOT NULL,
  "prompt_hash" TEXT NOT NULL,
  "model" TEXT,
  "cached_result" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_accessed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "gemini_analysis_cache_repository_id_fkey"
    FOREIGN KEY ("repository_id") REFERENCES "repositories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "gemini_analysis_cache_repo_commit_type_prompt_uq"
ON "gemini_analysis_cache"("repository_id", "commit_hash", "analysis_type", "prompt_hash");

CREATE INDEX "gemini_analysis_cache_repository_id_idx"
ON "gemini_analysis_cache"("repository_id");

CREATE INDEX "gemini_analysis_cache_expires_at_idx"
ON "gemini_analysis_cache"("expires_at");

