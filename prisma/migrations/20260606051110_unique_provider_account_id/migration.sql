/*
  Warnings:

  - You are about to drop the column `model` on the `gemini_analysis_cache` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[repository_id,commit_hash,analysis_type,prompt_hash,model_version,analysis_scope]` on the table `gemini_analysis_cache` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `change_type` on the `file_changes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DataResidencyRegion" AS ENUM ('US', 'EU', 'APAC');

-- CreateEnum
CREATE TYPE "AttemptType" AS ENUM ('LOGIN', 'SIGNUP', 'CHANGE_PASSWORD', 'DELETE_ACCOUNT', 'REPOSITORY_ANALYSIS', 'ANALYSIS_RUNNER');

-- CreateEnum
CREATE TYPE "FileChangeType" AS ENUM ('ADDED', 'MODIFIED', 'DELETED');

-- DropForeignKey
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_parent_id_fkey";

-- DropIndex
DROP INDEX "commits_repository_id_committed_at_idx";

-- DropIndex
DROP INDEX "gemini_analysis_cache_repo_commit_type_prompt_uq";

-- DropIndex
DROP INDEX "github_repos_user_id_enabled_repo_full_name_idx";

-- DropIndex
DROP INDEX "repositories_parent_id_idx";

-- DropIndex
DROP INDEX "verification_tokens_expires_idx";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "file_changes" DROP COLUMN "change_type",
ADD COLUMN     "change_type" "FileChangeType" NOT NULL;

-- AlterTable
ALTER TABLE "gemini_analysis_cache" DROP COLUMN "model",
ADD COLUMN     "analysis_scope" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "model_version" TEXT NOT NULL DEFAULT 'unknown';

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "inherited_region" "DataResidencyRegion",
ADD COLUMN     "last_synchronized_at" TIMESTAMP(3),
ADD COLUMN     "override_allowed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "security_sandboxes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_failed_attempt_at" TIMESTAMP(3),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "pr_impact_analyses" (
    "id" UUID NOT NULL,
    "pull_request_id" INTEGER NOT NULL,
    "head_sha" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION,
    "impact_summary" TEXT NOT NULL,
    "breaking_changes" BOOLEAN NOT NULL DEFAULT false,
    "ai_metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pr_impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_architecture_chunks" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "chunk_path" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_architecture_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_sync_jobs" (
    "id" UUID NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "repository_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "type" "AttemptType" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "userId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "ip" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quotas" (
    "id" UUID NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "requests_used" INTEGER NOT NULL DEFAULT 0,
    "tokens_consumed" INTEGER NOT NULL DEFAULT 0,
    "quota_window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quota_window_end" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_analysis_at" TIMESTAMP(3),
    "warning_posted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "github_org_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "data_residency_region" "DataResidencyRegion" NOT NULL DEFAULT 'US',
    "compliance_mode" TEXT NOT NULL DEFAULT 'STANDARD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enforce_security_reviews" BOOLEAN NOT NULL DEFAULT false,
    "enforce_secret_scanning" BOOLEAN NOT NULL DEFAULT false,
    "block_critical_secrets" BOOLEAN NOT NULL DEFAULT false,
    "blackout_windows_enabled" BOOLEAN NOT NULL DEFAULT false,
    "policy_lock_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_policy_assignments" (
    "id" UUID NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "organization_id" UUID NOT NULL,
    "inherited_policy" BOOLEAN NOT NULL DEFAULT true,
    "enforce_security_reviews" BOOLEAN,
    "enforce_secret_scanning" BOOLEAN,
    "block_critical_secrets" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_policy_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "repository_id" INTEGER,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_annotations" (
    "id" UUID NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "annotation_type" TEXT NOT NULL,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_activities" (
    "id" UUID NOT NULL,
    "annotation_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_knowledge" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "glossary" JSONB,
    "onboarding_notes" JSONB,
    "architecture_principles" JSONB,
    "project_description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_configs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "totp_secret" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_codes" TEXT,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_impact_analyses_pull_request_id_idx" ON "pr_impact_analyses"("pull_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_impact_analyses_pull_request_id_head_sha_key" ON "pr_impact_analyses"("pull_request_id", "head_sha");

-- CreateIndex
CREATE INDEX "repository_architecture_chunks_repository_id_idx" ON "repository_architecture_chunks"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_architecture_chunks_repository_id_chunk_path_key" ON "repository_architecture_chunks"("repository_id", "chunk_path");

-- CreateIndex
CREATE INDEX "repository_sync_jobs_repository_id_started_at_idx" ON "repository_sync_jobs"("repository_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "repository_sync_jobs_status_idx" ON "repository_sync_jobs"("status");

-- CreateIndex
CREATE INDEX "login_attempts_key_type_created_at_idx" ON "login_attempts"("key", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at");

-- CreateIndex
CREATE INDEX "ai_request_logs_userId_created_at_idx" ON "ai_request_logs"("userId", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_ip_created_at_idx" ON "ai_request_logs"("ip", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");

-- CreateIndex
CREATE INDEX "webhook_events_status_created_at_idx" ON "webhook_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_idx" ON "webhook_events"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quotas_installation_id_key" ON "ai_quotas"("installation_id");

-- CreateIndex
CREATE INDEX "ai_quotas_quota_window_end_idx" ON "ai_quotas"("quota_window_end");

-- CreateIndex
CREATE INDEX "rate_limits_key_idx" ON "rate_limits"("key");

-- CreateIndex
CREATE INDEX "rate_limits_key_expires_at_idx" ON "rate_limits"("key", "expires_at");

-- CreateIndex
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_github_org_id_key" ON "organizations"("github_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_policies_organization_id_key" ON "organization_policies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_policy_assignments_repository_id_key" ON "repository_policy_assignments"("repository_id");

-- CreateIndex
CREATE INDEX "repository_policy_assignments_organization_id_idx" ON "repository_policy_assignments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_repository_id_created_at_idx" ON "audit_logs"("repository_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "map_annotations_repository_id_idx" ON "map_annotations"("repository_id");

-- CreateIndex
CREATE INDEX "map_annotations_target_id_idx" ON "map_annotations"("target_id");

-- CreateIndex
CREATE INDEX "annotation_activities_annotation_id_created_at_idx" ON "annotation_activities"("annotation_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "repository_knowledge_repository_id_key" ON "repository_knowledge"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_configs_user_id_key" ON "mfa_configs"("user_id");

-- CreateIndex
CREATE INDEX "mfa_configs_user_id_idx" ON "mfa_configs"("user_id");

-- CreateIndex
CREATE INDEX "accounts_provider_idx" ON "accounts"("provider");

-- CreateIndex
CREATE INDEX "analysis_jobs_status_lock_expires_at_next_run_at_idx" ON "analysis_jobs"("status", "lock_expires_at", "next_run_at");

-- CreateIndex
CREATE INDEX "analysis_jobs_repository_id_created_at_idx" ON "analysis_jobs"("repository_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analysis_jobs_user_id_created_at_idx" ON "analysis_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analysis_jobs_repository_id_status_idx" ON "analysis_jobs"("repository_id", "status");

-- CreateIndex
CREATE INDEX "commits_repository_id_committed_at_idx" ON "commits"("repository_id", "committed_at" DESC);

-- CreateIndex
CREATE INDEX "file_changes_commit_id_idx" ON "file_changes"("commit_id");

-- CreateIndex
CREATE INDEX "gemini_analysis_cache_model_version_idx" ON "gemini_analysis_cache"("model_version");

-- CreateIndex
CREATE UNIQUE INDEX "gemini_analysis_cache_repository_id_commit_hash_analysis_ty_key" ON "gemini_analysis_cache"("repository_id", "commit_hash", "analysis_type", "prompt_hash", "model_version", "analysis_scope");

-- CreateIndex
CREATE INDEX "github_repos_updated_at_idx" ON "github_repos"("updated_at");

-- CreateIndex
CREATE INDEX "github_repos_user_id_enabled_repo_full_name_idx" ON "github_repos"("user_id", "enabled" DESC, "repo_full_name" ASC);

-- CreateIndex
CREATE INDEX "languages_repository_id_idx" ON "languages"("repository_id");

-- CreateIndex
CREATE INDEX "repositories_url_idx" ON "repositories"("url");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");

-- AddForeignKey
ALTER TABLE "pr_impact_analyses" ADD CONSTRAINT "pr_impact_analyses_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_architecture_chunks" ADD CONSTRAINT "repository_architecture_chunks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_sync_jobs" ADD CONSTRAINT "repository_sync_jobs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_policies" ADD CONSTRAINT "organization_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_policy_assignments" ADD CONSTRAINT "repository_policy_assignments_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_policy_assignments" ADD CONSTRAINT "repository_policy_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_activities" ADD CONSTRAINT "annotation_activities_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "map_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_activities" ADD CONSTRAINT "annotation_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_knowledge" ADD CONSTRAINT "repository_knowledge_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_configs" ADD CONSTRAINT "mfa_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "repositories_user_url_target_directory_idx" RENAME TO "repositories_user_id_url_target_directory_idx";
