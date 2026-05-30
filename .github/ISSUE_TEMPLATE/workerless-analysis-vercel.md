---
name: "Workerless repo analysis on Vercel"
about: "Remove the separate analysis worker; process analysis jobs from the Vercel-deployed Next.js app"
title: "Migrate to workerless repo analysis on Vercel"
labels: ["enhancement", "infra"]
---

## Context
Today, repo analysis is asynchronous:

- API enqueues an `AnalysisJob` (e.g. `POST /analyze`, `POST /api/repositories`, `POST /api/repositories/[id]/analyze`).
- A separate worker process (`scripts/analysisWorker.ts`, built into `dist-worker/`) polls the DB, claims jobs (`analysisJobService.claimNextJob`), and runs `repositoryService.analyzeRepository`.
- Job progress is written to `analysis_jobs` and polled via `GET /api/analysis-jobs/[id]`.

This works on Cloud Run with a dedicated worker service, but it is not “Vercel-native” and requires running/operating an additional worker deployment.

## Goal
Deploy on Vercel with **no separate worker service** while keeping the current UX:

- Users can queue an analysis job.
- Progress and status are visible via the existing job status endpoint.
- Jobs are processed automatically by the Vercel deployment.

## Constraints / risks to address
- **Vercel execution limits:** serverless functions have max duration and may be terminated mid-run.
- **Ephemeral filesystem:** analysis currently clones to `os.tmpdir()`.
- **System `git` dependency:** `lib/services/gitService.ts` shells out to `git` (and some utilities like `sed`). Vercel runtimes may not have these binaries available.
- **Job attempts semantics:** attempts are incremented in `claimNextJob`; if a function is killed mid-run, the job might be re-claimed and attempts could burn quickly.

## Proposed approach (high-level)
Replace the “always-on polling worker” with a **Vercel-triggered job runner**:

1. Add a server route (internal) that claims and runs **one** job (or a small bounded batch) per invocation.
2. Trigger it periodically using **Vercel Cron** (or an equivalent Vercel-compatible scheduler).
3. Keep using DB locking (`lockedBy`, `lockExpiresAt`) to prevent concurrent processing.

## Acceptance criteria
- Vercel deployment processes queued `AnalysisJob`s without running `npm run worker` / Cloud Run worker.
- Progress updates continue to appear when polling `GET /api/analysis-jobs/[id]`.
- The system is safe under concurrency (multiple cron invocations) and does not double-process jobs.
- Documentation reflects the new deployment model (Vercel-first; worker optional/deprecated).

## Implementation tasks
### 1) Add a Vercel-friendly job runner route
- Create an internal endpoint, e.g. `POST /api/internal/analysis-jobs/run` (name/location flexible), that:
  - Authenticates the caller (cron) via either:
    - a shared secret (recommended), and/or
    - any trusted “cron invocation” signal Vercel provides (verify exact header behavior).
  - Calls `analysisJobService.claimNextJob({ workerId, lockMs })`.
  - If no job is available, returns `204`.
  - If a job is claimed, runs the same logic as `scripts/analysisWorker.ts` (heartbeat + progress + `repositoryService.analyzeRepository`).
  - Uses `runtime = "nodejs"` (required for `child_process` if we keep `git` shelling) and sets an appropriate `maxDuration` for Vercel.

### 2) Schedule the runner
- Add Vercel Cron configuration (likely via `vercel.json`) to call the runner endpoint on an interval (e.g. every 1–5 minutes).
- Add required env vars (e.g. `ANALYSIS_CRON_SECRET`) and update `.env.example`.

### 3) Make repository analysis compatible with Vercel runtimes
Decide and implement one of these paths:

- **Option A (keep `git`):** verify `git` and required shell utilities are present in the Vercel runtime used for this project; if not, this option is blocked.
- **Option B (remove system deps):** refactor `GitService` to avoid shelling out by using:
  - `isomorphic-git` (pure JS) or
  - provider APIs (GitHub REST/GraphQL) for commits/tree/languages.

Document whichever approach we choose and any feature limitations (e.g. GitHub-only initially).

### 4) Handle timeouts + partial progress safely
- Ensure the runner can be terminated and the job can resume safely after lock expiry.
- Consider:
  - reducing clone depth / limiting commits for very large repos,
  - splitting analysis into phases (persist a cursor/state in DB),
  - and/or implementing a hard “repo size / commit count” cap with a clear error message.

### 5) Decommission worker deployment path (or make it optional)
- Update docs and deployment scripts to remove the requirement to deploy a worker service.
- Optional: keep the worker scripts for local/dev or non-Vercel deployments, but mark them as legacy.

## Notes / pointers
- Enqueue endpoints: `POST /analyze`, `POST /api/repositories`, `POST /api/repositories/[id]/analyze`.
- Status endpoint: `GET /api/analysis-jobs/[id]`.
- Worker loop to mirror: `scripts/analysisWorker.ts`.
- DB claim/lock logic: `lib/services/analysisJobService.ts`.
- Git shelling: `lib/services/gitService.ts`.
