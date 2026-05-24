-- Create a partial unique index to enforce that only one active analysis job
-- can exist per repository.
CREATE UNIQUE INDEX "analysis_jobs_active_unique_idx" 
ON "analysis_jobs"("repository_id") 
WHERE "status" IN ('QUEUED', 'PROCESSING');
