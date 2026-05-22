-- CreateEnum
CREATE TYPE "PullRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'MERGED', 'FAILED');

-- CreateTable
CREATE TABLE "github_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "github_user_id" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "installation_id" BIGINT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" SERIAL NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "head_sha" TEXT NOT NULL,
    "html_url" TEXT NOT NULL,
    "status" "PullRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_reviews" (
    "id" SERIAL NOT NULL,
    "pull_request_id" INTEGER NOT NULL,
    "head_sha" TEXT NOT NULL,
    "review_text" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_accounts_user_id_key" ON "github_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_accounts_github_user_id_key" ON "github_accounts"("github_user_id");

-- CreateIndex
CREATE INDEX "github_accounts_username_idx" ON "github_accounts"("username");

-- CreateIndex
CREATE INDEX "github_repos_installation_id_idx" ON "github_repos"("installation_id");

-- CreateIndex
CREATE INDEX "github_repos_enabled_idx" ON "github_repos"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "github_repos_user_id_repo_full_name_key" ON "github_repos"("user_id", "repo_full_name");

-- CreateIndex
CREATE INDEX "pull_requests_repo_id_idx" ON "pull_requests"("repo_id");

-- CreateIndex
CREATE INDEX "pull_requests_head_sha_idx" ON "pull_requests"("head_sha");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_repo_id_pr_number_key" ON "pull_requests"("repo_id", "pr_number");

-- CreateIndex
CREATE INDEX "pr_reviews_created_at_idx" ON "pr_reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pr_reviews_pull_request_id_head_sha_key" ON "pr_reviews"("pull_request_id", "head_sha");

-- AddForeignKey
ALTER TABLE "github_accounts" ADD CONSTRAINT "github_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repos" ADD CONSTRAINT "github_repos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "github_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_reviews" ADD CONSTRAINT "pr_reviews_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
