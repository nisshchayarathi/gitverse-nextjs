-- CreateIndex
CREATE INDEX "file_changes_commit_id_idx" ON "file_changes"("commit_id");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");
