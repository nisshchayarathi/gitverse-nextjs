-- CreateTable
CREATE TABLE "security_sandboxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repository_id" INTEGER NOT NULL,
    "pull_request_id" INTEGER,
    "head_sha" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "container_id" TEXT,
    "image_url" TEXT,
    "test_results" JSONB,
    "exploit_payload" TEXT,
    "stack_trace" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_sandboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_sandboxes_repository_id_head_sha_idx" ON "security_sandboxes"("repository_id", "head_sha");

-- CreateIndex
CREATE INDEX "security_sandboxes_status_idx" ON "security_sandboxes"("status");

-- AddForeignKey
ALTER TABLE "security_sandboxes" ADD CONSTRAINT "security_sandboxes_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
