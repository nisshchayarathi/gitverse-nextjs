-- Add AnalysisJob table for durable async processing

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "analysis_jobs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "type" text NOT NULL DEFAULT 'repository_analysis',

  "repository_id" integer NOT NULL,
  "user_id" integer NOT NULL,

  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "next_run_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "progress_percent" integer,
  "progress_message" text,
  "progress_details" jsonb,

  "locked_at" timestamp(3),
  "locked_by" text,
  "lock_expires_at" timestamp(3),

  "started_at" timestamp(3),
  "finished_at" timestamp(3),

  "error" text,

  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analysis_jobs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "analysis_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "analysis_jobs_status_next_run_at_idx" ON "analysis_jobs"("status", "next_run_at");
CREATE INDEX IF NOT EXISTS "analysis_jobs_lock_expires_at_idx" ON "analysis_jobs"("lock_expires_at");
CREATE INDEX IF NOT EXISTS "analysis_jobs_repository_id_idx" ON "analysis_jobs"("repository_id");
CREATE INDEX IF NOT EXISTS "analysis_jobs_user_id_idx" ON "analysis_jobs"("user_id");
