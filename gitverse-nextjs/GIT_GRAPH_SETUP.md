# Git Graph Setup - Database Schema Update

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)

Added two new fields to the `Commit` model:

- **`parents`**: Array of parent commit hashes (needed for merge detection)
- **`tags`**: Array of Git tags associated with commits

### 2. Git Service (`lib/services/gitService.ts`)

Updated to fetch:

- Parent commit hashes using `%P` format
- Git tags using `%D` format and parsing tag references

### 3. Repository Service (`lib/services/repositoryService.ts`)

Updated to store the new `parents` and `tags` fields when saving commits.

## Next Steps

### 1. Run Prisma Migration

```bash
cd gitverse-nextjs
npx prisma migrate dev --name add-commit-parents-and-tags
```

This will:

- Create a new migration file
- Update your database schema
- Add the `parents` and `tags` columns to the `commits` table

### 2. Regenerate Prisma Client

```bash
npx prisma generate
```

### 3. Re-analyze Existing Repositories

To see the git graph with branches and merges, you'll need to re-analyze your repositories so the new parent and tag data is fetched:

- Go to your repository page
- Click "Re-analyze" or delete and re-add the repository
- The system will now fetch parent commit hashes and tags

### 4. Verify the Data

After re-analyzing, check that:

- Commits with multiple parents show as merge commits
- Branch lines connect properly based on parent relationships
- Tags appear on the relevant commits

## What This Fixes

✅ **Branch Visualization**: Multiple branches will now display in parallel lanes
✅ **Merge Detection**: Merge commits (commits with 2+ parents) are properly identified
✅ **Merge Lines**: Curved lines show where branches merge together
✅ **Tag Display**: Git tags (v1.0, v2.0, etc.) appear on commits
✅ **Git Graph Accuracy**: The graph now matches Git's actual commit parent relationships

## Technical Details

**Parent Hashes**: Git tracks which commit(s) came before each commit. A commit with:

- 1 parent = normal commit
- 2+ parents = merge commit
- 0 parents = initial commit

The graph algorithm uses these parent relationships to:

- Draw lines between parent and child commits
- Detect when branches merge
- Position commits in the correct columns
- Show branch splits and joins
