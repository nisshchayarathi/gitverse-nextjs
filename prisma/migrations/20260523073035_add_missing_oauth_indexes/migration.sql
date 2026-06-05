-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");
