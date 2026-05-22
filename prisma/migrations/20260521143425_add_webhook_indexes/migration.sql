-- CreateIndex
CREATE INDEX "github_repos_repo_full_name_enabled_installation_id_idx" ON "github_repos"("repo_full_name", "enabled", "installation_id");

-- CreateIndex
CREATE INDEX "github_repos_updated_at_idx" ON "github_repos"("updated_at");
