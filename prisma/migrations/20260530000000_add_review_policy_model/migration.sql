-- CreateTable
CREATE TABLE "review_policies" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_policies_repository_id_idx" ON "review_policies"("repository_id");

-- AddForeignKey
ALTER TABLE "review_policies" ADD CONSTRAINT "review_policies_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
