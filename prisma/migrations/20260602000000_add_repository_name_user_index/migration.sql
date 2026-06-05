-- Migration: add_repository_name_user_index
--
-- This migration adds a composite index on (user_id, name) to speed up 
-- repository name-uniqueness checks within the createRepository method of 
-- repositoryService.ts (Issue #730).
--

-- Add composite index for name-uniqueness check in createRepository
-- Covers: prisma.repository.findFirst({ where: { name, userId } })
CREATE INDEX "repositories_user_id_name_idx" ON "repositories"("user_id", "name");
