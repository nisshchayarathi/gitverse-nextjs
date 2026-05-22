-- CreateIndex
CREATE INDEX "analysis_jobs_status_lock_expires_at_next_run_at_idx" ON "analysis_jobs"("status", "lock_expires_at", "next_run_at");
