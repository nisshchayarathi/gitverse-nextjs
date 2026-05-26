-- CreateIndex
CREATE INDEX IF NOT EXISTS "github_repos_user_id_enabled_repo_full_name_idx" ON "github_repos"("user_id", "enabled", "repo_full_name");
