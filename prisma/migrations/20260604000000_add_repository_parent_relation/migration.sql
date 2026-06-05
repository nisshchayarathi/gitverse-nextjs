-- Migration: add_repository_parent_relation
--
-- Adds parent_id column and self-referencing foreign key to the repositories
-- table so that sub-repositories (monorepo packages) can reference their
-- parent repository. The subPackages relation exposes the inverse side.
--

-- Add parent_id column (nullable, since root repositories have no parent)
ALTER TABLE "repositories" ADD COLUMN "parent_id" INTEGER;

-- Add self-referencing foreign key constraint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "repositories"(id)
  ON DELETE SET NULL;

-- Index for efficient lookup of sub-repositories by parent
CREATE INDEX "repositories_parent_id_idx" ON "repositories"("parent_id");
