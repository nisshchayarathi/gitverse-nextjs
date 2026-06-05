-- AddIndex: repositories(user_id, created_at DESC)
-- Optimises: listRepositories WHERE userId ORDER BY createdAt DESC
CREATE INDEX "repositories_user_id_created_at_idx" ON "repositories"("user_id", "created_at" DESC);

-- AddIndex: repositories(user_id, url)
-- Optimises: createRepository duplicate check WHERE url + userId
CREATE INDEX "repositories_user_id_url_idx" ON "repositories"("user_id", "url");

-- AddIndex: analysis_jobs(repository_id, user_id, created_at DESC)
-- Optimises: GET /api/repositories/[id] latestJob WHERE repositoryId + userId ORDER BY createdAt DESC
CREATE INDEX "analysis_jobs_repository_id_user_id_created_at_idx" ON "analysis_jobs"("repository_id", "user_id", "created_at" DESC);

-- AddIndex: accounts(user_id, provider)
-- Optimises: auth COUNT checks WHERE userId + provider (runs on every login/signup)
CREATE INDEX "accounts_user_id_provider_idx" ON "accounts"("user_id", "provider");

-- AddIndex: github_repos(user_id, enabled DESC, repo_full_name ASC)
-- Optimises: pr-reviews / repositories / connected-repos WHERE userId ORDER BY enabled DESC, repoFullName ASC
CREATE INDEX "github_repos_user_id_enabled_repo_full_name_idx" ON "github_repos"("user_id", "enabled" DESC, "repo_full_name" ASC);

-- AddIndex: github_repos(user_id, installation_id)
-- Optimises: sync / delete WHERE userId AND installationId IS NOT NULL
CREATE INDEX "github_repos_user_id_installation_id_idx" ON "github_repos"("user_id", "installation_id");

-- AddIndex: branches(repository_id, is_default DESC)
-- Optimises: getRepository ORDER BY isDefault DESC scoped to a repo
CREATE INDEX "branches_repository_id_is_default_idx" ON "branches"("repository_id", "is_default" DESC);

-- AddIndex: file_changes(file_id)
-- Optimises: onDelete SetNull cascade lookups on file_id FK
CREATE INDEX "file_changes_file_id_idx" ON "file_changes"("file_id");

-- AddIndex: contributors(repository_id, commits DESC)
-- Optimises: getRepository ORDER BY commits DESC scoped to a repo
CREATE INDEX "contributors_repository_id_commits_idx" ON "contributors"("repository_id", "commits" DESC);

-- AddIndex: languages(repository_id, percentage DESC)
-- Optimises: getRepository + listRepositories ORDER BY percentage DESC scoped to a repo
CREATE INDEX "languages_repository_id_percentage_idx" ON "languages"("repository_id", "percentage" DESC);
