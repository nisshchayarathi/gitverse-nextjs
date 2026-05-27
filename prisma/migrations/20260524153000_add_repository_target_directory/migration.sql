-- Allow scoping repository analysis to a specific sub-directory (monorepo workspace).
ALTER TABLE "repositories" ADD COLUMN "target_directory" TEXT;

-- Speed up lookups for (user, repo url, target directory) combinations.
CREATE INDEX "repositories_user_url_target_directory_idx"
ON "repositories"("user_id", "url", "target_directory");

