-- Add README storage fields to repositories

ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "readme_path" TEXT;
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "readme_text" TEXT;
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "readme_fetched_at" TIMESTAMP(3);
