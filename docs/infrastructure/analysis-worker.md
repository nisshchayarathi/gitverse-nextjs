# Analysis Worker — Architecture and Concurrency

## Overview

The analysis worker processes queued analysis jobs (`analysis_jobs` table) on a scheduled basis. It runs as a GitHub Actions cron job every 5 minutes (`run-analysis-cron.yml`) and processes up to `CRON_WORKER_BATCH` jobs per run (default: 5), with a hard timeout of `CRON_WORKER_TIMEOUT_MS` (default: 240 seconds).

## Concurrency and Race Prevention

The workflow uses a **concurrency group** to guarantee that only one worker run is active at a time:

```yaml
concurrency:
  group: analysis-worker-${{ github.ref }}
  cancel-in-progress: false
```

This is critical because:
- The schedule runs `*/5 * * * *` (every 5 minutes)
- The worker has a 240-second timeout
- If a run exceeds 240 seconds, the next cron trigger would start a second worker before the first finishes
- Without concurrency control, two workers would modify the same DB rows simultaneously

`cancel-in-progress: false` means the queued run waits for the in-progress run to complete rather than cancelling it. This is deliberate: terminating a worker mid-analysis would leave jobs in an inconsistent `PROCESSING` state with no one to recover them.

## Lock Management

### Why There Is No Separate Lock Cleanup Step

The workflow does **not** include a separate "Release stale locks" step before starting the worker. The worker itself handles lock reclamation during initialization:

```
cronWorker.ts → runOnce() → reclaimOrphanedJobs() → claimNextJob() (loop)
```

This eliminates the race condition that existed when a separate Node.js process (the inline `node -e` script in the workflow YAML) and the worker both tried to update `analysis_jobs` rows independently. Two processes writing to the same table without coordination could:
1. Both read the same expired locks
2. Both update them to QUEUED (idempotent but wasteful)
3. The worker could read stale data if the inline script's transaction had not fully committed

The worker's `claimNextJob()` method also calls `reclaimOrphanedJobs()` internally as a precondition of every claim attempt, ensuring locks are always cleaned up before new jobs are acquired.

### Job Locking Mechanism

Each job carries:
- `locked_by`: The worker ID that claimed the job
- `locked_at`: When the lock was acquired
- `lock_expires_at`: When the lock automatically expires (default: 5 minutes from acquisition)

Workers extend the lock via `heartbeat()` during long-running analyses. If a worker crashes without releasing its locks, the locks expire naturally and `reclaimOrphanedJobs()` returns them to the QUEUED pool.

The SQL in `claimNextJob()` uses `FOR UPDATE SKIP LOCKED` inside a `$transaction`:

```sql
WITH candidate AS (
  SELECT a1.id FROM analysis_jobs a1
  WHERE a1.next_run_at <= NOW()
    AND a1.status IN ('QUEUED', 'PROCESSING')
    AND (a1.lock_expires_at IS NULL OR a1.lock_expires_at < NOW())
    AND NOT EXISTS (
      SELECT 1 FROM analysis_jobs a2
      WHERE a2.repository_id = a1.repository_id
        AND a2.status = 'PROCESSING'
        AND a2.id != a1.id
        AND (a2.lock_expires_at IS NULL OR a2.lock_expires_at > NOW())
    )
  ORDER BY a1.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE analysis_jobs j
SET status = 'PROCESSING', ...
FROM candidate
WHERE j.id = candidate.id
RETURNING j.id
```

This guarantees:
- Each job is claimed at most once per cycle
- Two workers never claim the same job
- A repository cannot have two concurrent analyses (`NOT EXISTS` subquery)
- `FOR UPDATE SKIP LOCKED` means workers don't block each other — they pick distinct rows

## Worker Lifecycle

```
main()
  └── runOnce()
        ├── checkDatabaseConnectivity()  → SELECT 1
        ├── reclaimOrphanedJobs()        → release expired locks
        └── for each job in batch:
              ├── claimNextJob()         → atomic claim via CTE
              ├── processJob()
              │     ├── getJob()
              │     ├── analyzeRepository()
              │     └── markDone() / markFailed()
              └── release from acquiredJobIds[]
```

### Signal Handling

The worker registers handlers for `SIGTERM`, `SIGINT`, and `SIGQUIT`:

```ts
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));
```

On shutdown:
1. Sets `shuttingDown` flag (debounce)
2. Calls `releaseAllLocks()` to expire all held locks (so they become QUEUED immediately rather than waiting 5 minutes)
3. Calls `disconnectPrisma()`
4. Exits with code 0

The workflow uses `timeout --kill-after=30 240`:
- First 240s: `SIGTERM` to the worker (graceful shutdown)
- After 30s grace: `SIGKILL` (forced)

This gives the worker up to 30 seconds to release locks before being killed.

### Unhandled Rejection Handling

```ts
process.on("unhandledRejection", async (reason) => {
  await releaseAllLocks();
  await disconnectPrisma();
  process.exit(1);
});
```

Any unhandled promise rejection triggers lock release before exit.

## Crash Recovery and Idempotency

### Orphaned Job Recovery

When a worker crashes without releasing locks:

1. The `lock_expires_at` timestamp remains set (default: 5 minutes from acquisition)
2. No heartbeat extends it
3. After 5 minutes, `reclaimOrphanedJobs()` (called by cron worker and every `claimNextJob()`) finds jobs where `lock_expires_at < NOW()` and `status = 'PROCESSING'`
4. These jobs are reset to `QUEUED` with `locked_by = null`
5. The next worker claim picks them up

### Duplicate Prevention via Database Constraints

The `analysis_jobs` table enforces at most one active job per repository via the `claimNextJob()` CTE's `NOT EXISTS` subquery. When a job is reclaimed after a crash, its repository_id is no longer blocked (the old lock has expired), so a new analysis can start.

### What Happens on Duplicate Cron Runs

If concurrency control fails (e.g., `concurrency.group` is misconfigured), the worker has a defense-in-depth layer:
- `claimNextJob()` uses `FOR UPDATE SKIP LOCKED` — concurrent workers pick different jobs
- `reclaimOrphanedJobs()` is idempotent — updating rows from PROCESSING to QUEUED is safe to repeat
- Each job's `attempts` counter prevents infinite reprocessing (maxAttempts = 3, retryable errors only)

## Worker Script Reference

| File | Purpose |
|------|---------|
| `scripts/cronWorker.ts` | Main cron worker entry point |
| `lib/services/analysisJobService.ts` | Job CRUD, locking, claiming, progress |
| `lib/services/repositoryService.ts` | Repository analysis logic |

## Job Status Lifecycle

```
QUEUED → PROCESSING → DONE
  ↑          |
  │          ↓ (error, retryable)
  └── QUEUED (with backoff)
  │          ↓ (error, not retryable)
  │        FAILED
  │
  └── (crash) PROCESSING → lock expires → QUEUED
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_WORKER_TIMEOUT_MS` | `300000` (5 min) | Max worker runtime before deadline check |
| `CRON_WORKER_BATCH` | `5` | Max jobs per worker run |
| `WORKER_ID` | `cron-{hostname}-{pid}-{timestamp}` | Unique worker identifier for locks |
