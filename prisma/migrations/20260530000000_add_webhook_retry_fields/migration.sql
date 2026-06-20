-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "max_retries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "next_retry_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_idx" ON "webhook_events"("status", "next_retry_at");
