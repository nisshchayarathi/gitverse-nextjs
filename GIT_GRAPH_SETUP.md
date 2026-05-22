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

## Security & Access Control

To protect private repository data and analysis results, GitVerse enforces strict ownership and caching rules across all user-scoped API endpoints.

### Ownership Enforcement Strategy

Before returning sensitive data (e.g., repository insights or commit history), the backend middleware must validate that the authenticated user actually owns the requested resource.
- **Authorized:** If `repository.userId === user.id`, the data is safely returned.
- **Unauthorized (404/403):** If a user attempts to access another user's private data, the API will intentionally return a generic `404 Not Found` or `403 Forbidden` to prevent leaking the existence or metadata of private resources.

### Cache-Control: `no-store`

All endpoints returning private or user-scoped data explicitly define HTTP caching directives to prevent accidental data leakage via proxies or browsers.

**Example Response Header:**
```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
```

This guarantees that:
- Browsers never cache sensitive repository data.
- CDNs or edge proxies do not mistakenly serve one user's data to another.
- API requests always hit the origin server to re-verify authentication and ownership.

### Best Practices for Protected Endpoints

When developing new GitVerse API routes, always adhere to the following pattern:
1. Extract and validate the session `user`.
2. Fetch the resource and perform an ownership check.
3. Return `404 Not Found` if the ownership check fails.
4. Append `Cache-Control: no-store` to the `NextResponse` before returning.
