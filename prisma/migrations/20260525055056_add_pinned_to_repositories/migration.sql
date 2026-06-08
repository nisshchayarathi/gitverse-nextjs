/*
  Warnings:

  - You are about to drop the `analysis_jobs` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `change_type` on the `file_changes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FileChangeType" AS ENUM ('ADDED', 'MODIFIED', 'DELETED');

-- DropForeignKey
ALTER TABLE "analysis_jobs" DROP CONSTRAINT "analysis_jobs_repository_id_fkey";

-- DropForeignKey
ALTER TABLE "analysis_jobs" DROP CONSTRAINT "analysis_jobs_user_id_fkey";

-- DropIndex
DROP INDEX "commits_repository_id_committed_at_idx";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "file_changes" DROP COLUMN "change_type",
ADD COLUMN     "change_type" "FileChangeType" NOT NULL;

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "analysis_jobs";

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "type" TEXT NOT NULL DEFAULT 'repository_analysis',
    "repository_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress_percent" INTEGER,
    "progress_message" TEXT,
    "progress_details" JSONB,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "lock_expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisJob_status_next_run_at_idx" ON "AnalysisJob"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "AnalysisJob_lock_expires_at_idx" ON "AnalysisJob"("lock_expires_at");

-- CreateIndex
CREATE INDEX "AnalysisJob_repository_id_created_at_idx" ON "AnalysisJob"("repository_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "AnalysisJob_user_id_created_at_idx" ON "AnalysisJob"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "AnalysisJob_repository_id_status_idx" ON "AnalysisJob"("repository_id", "status");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "commits_repository_id_committed_at_idx" ON "commits"("repository_id", "committed_at" DESC);

-- CreateIndex
CREATE INDEX "file_changes_file_id_idx" ON "file_changes"("file_id");

-- CreateIndex
CREATE INDEX "file_changes_commit_id_idx" ON "file_changes"("commit_id");

-- CreateIndex
CREATE INDEX "languages_repository_id_idx" ON "languages"("repository_id");

-- CreateIndex
CREATE INDEX "repositories_url_idx" ON "repositories"("url");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
