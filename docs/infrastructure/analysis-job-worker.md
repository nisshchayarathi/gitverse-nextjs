# Analysis Job Worker — Concurrency Architecture

## Overview

The analysis job worker system processes long-running repository analysis
jobs (repository_analysis, architecture_generation) in the background.
Jobs are stored as rows in the `analysis_jobs` table and claimed by workers
via a PostgreSQL-level locking protocol.

This document describes the concurrency model, the race conditions it
prevents, and the protocol that guarantees exactly-once semantics under
contention.

## Job lifecycle

```
    ┌─────────┐
    │  QUEUED │◄───────────── rejected / drained
    └────┬────┘
         │ claimNextJob()
         ▼
    ┌───────────┐
    │ PROCESSING│◄────────── heartbeat (every 30s)
    └─────┬─────┘
          │
     ┌────┴────┐
     ▼         ▼
  ┌──────┐ ┌────────┐
  │ DONE │ │ FAILED │
  └──────┘ └────────┘
```

## Claim protocol (`claimNextJob`)

The claim is a single `$transaction` with two steps:

### Step 1 — Reclaim orphaned jobs

```sql
UPDATE analysis_jobs
SET
  status = 'QUEUED',
  locked_by = NULL,
  locked_at = NULL,
  lock_expires_at = NULL,
  lock_token = NULL,
  updated_at = NOW()
WHERE status = 'PROCESSING'
  AND lock_expires_at < NOW()
```

Any PROCESSING job whose lock has expired is reset to QUEUED.  This
handles workers that crashed without releasing their lock.

### Step 2 — CTE claim

```sql
WITH candidate AS (
  SELECT a1.id
  FROM analysis_jobs a1
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
SET
  status = 'PROCESSING',
  locked_at = NOW(),
  locked_by = ${workerId},
  lock_expires_at = NOW() + (${lockMs}::int * INTERVAL '1 millisecond'),
  lock_token = gen_random_uuid(),
  attempts = j.attempts + 1,
  started_at = COALESCE(j.started_at, NOW()),
  updated_at = NOW()
FROM candidate
WHERE j.id = candidate.id
RETURNING j.id
```

Key properties:

- **Per-repo exclusivity**: The `NOT EXISTS` subquery prevents two jobs
  for the same repository from being PROCESSING at the same time.

- **FOR UPDATE SKIP LOCKED**: Rows locked by another transaction are
  skipped rather than waited on, so workers never block each other.

- **gen_random_uuid()**: Every claim generates a fresh `lock_token`.
  This token is the worker's proof of ownership for subsequent operations.

## Race conditions eliminated

### Race 1: TOCTOU between reclaim and claim

**Before**: `reclaimOrphanedJobs()` ran as a standalone `updateMany`
outside the `claimNextJob` transaction.  Between reclaim and the CTE,
another worker could insert a new QUEUED job or claim the same reclaimed
job.

**After**: Reclaim runs inside the same `$transaction` as the CTE.
PostgreSQL snapshot isolation ensures that the CTE sees every row that
was just reclaimed, and `FOR UPDATE` locks prevent concurrent claims.

### Race 2: Zombie worker heartbeat overwrite

**Before**: The heartbeat only checked `locked_by = workerId`.  If a
worker's lock expired and another worker claimed the job, the first
worker's stale heartbeat could still succeed if it arrived before the
new claim wrote its `locked_by`.

**After**: The heartbeat includes `lock_token = ${lockToken}::uuid` in the
WHERE clause.  After reclaim sets `lock_token = NULL` and the new claim
generates a fresh `lock_token`, the old worker's heartbeat no longer
matches the row.

### Race 3: Webhook queue non-atomic count-then-fetch

**Before**: `triggerWorkers()` counted active workers and pending jobs in
separate queries, then fetched a batch of pending jobs.  Two concurrent
calls could each count the same active workers and fetch the same pending
jobs, causing duplicate dispatch.

**After**: `triggerWorkers()` is deprecated and returns metrics only.
Job dispatch is now handled by BullMQ, which provides atomic dequeue
semantics.

### Race 4: No atomic status transition on webhook dispatch

**Before**: Dispatched webhook events were not atomically marked as
`processing` before being sent to the worker.  Duplicate dispatches
could both pass the status check in the worker handler.

**After**: BullMQ's worker dequeue is atomic.  Each event is enqueued
exactly once via `addBulk()`.

### Race 5: In-memory buffer in serverless

**Before**: `globalThis.webhookBuffer` with a 500ms `setTimeout` flush.
In Vercel serverless, each request hit a different Lambda instance.
The buffer was per-instance, non-durable, and could lose events on
cold start or instance termination.

**After**: `enqueueWebhook()` writes directly to PostgreSQL via Prisma,
then enqueues to BullMQ.  All I/O completes before the HTTP response
is sent.

## Lock token protocol

### Generation

The `claimNextJob` CTE generates a fresh UUID via `gen_random_uuid()`
and stores it in the `lock_token` column.  This token is returned to
the caller as part of the `AnalysisJob` row.

### Usage

All mutating operations that follow the claim must include the
`lockToken` to prove ownership:

| Operation | WHERE clause includes |
|-----------|----------------------|
| `heartbeat` | `locked_by = workerId AND lock_token = token` |
| `markDone` | `locked_by = workerId AND lock_token = token` |
| `markFailed` | `locked_by = workerId AND lock_token = token` |
| `updateProgress` | `locked_by = workerId AND lock_token = token` |
| `releaseLock` | `locked_by = workerId AND lock_token = token` |
| `markDrainReleased` | `locked_by = workerId AND lock_token = token` |

### Invalidation

The `lock_token` is set to NULL (invalidated) in these scenarios:

- **Reclaim**: When `reclaimOrphanedJobs()` resets an expired-lock job
  to QUEUED, it also clears `lock_token`.  Any subsequent stale
  operation from the old owner will fail the WHERE check.

- **Re-claim**: When `claimNextJob` claims a job, it generates a new
  `lock_token`.  The old owner's token is no longer valid.

- **Completion**: `markDone` and `markFailed` clear `lock_token` along
  with the lock fields.

- **Drain**: `markDrainReleased` and `releaseLock` also clear it.

## Heartbeat protocol

The analysis worker sends a heartbeat every 30 seconds while processing
a job.  The heartbeat extends `lock_expires_at` by the configured
`lockMs` (default 5 minutes).

```typescript
await analysisJobService.heartbeat({
  jobId: job.id,
  workerId: WORKER_ID,
  lockToken: job.lockToken!,  // token from claimNextJob
  lockMs: 5 * 60 * 1000,
});
```

If the heartbeat fails (0 rows updated), the worker knows it no longer
owns the lock and should stop processing.  This prevents the zombie
worker scenario: a displaced worker cannot extend a lock it no longer
holds.

## Graceful drain

When a worker receives a shutdown signal, it calls `markDrainReleased`
for each job it holds.  This sets the job back to QUEUED with a fresh
`nextRunAt`, allowing another worker to pick it up immediately.

The drain endpoint (`/drain` on the worker health server) initiates
this sequence and waits up to 35 seconds for in-flight jobs to
complete before forcing an exit.

## Cleanup fallback

The `cleanupStaleJobs()` method is a safety net for workers that
terminate without releasing their locks.  It scans for PROCESSING jobs
whose `lockExpiresAt` has passed and `updatedAt` is older than a grace
period (default 10 minutes), then marks them as FAILED.

This method is called by the cron worker and the `/api/cron/run-analysis`
endpoint.

## Database schema

```prisma
model AnalysisJob {
  id              String    @id @default(uuid()) @db.Uuid
  status          JobStatus @default(QUEUED)
  lockedBy        String?   @map("locked_by")
  lockExpiresAt   DateTime? @map("lock_expires_at")
  lockToken       String?   @map("lock_token")
  // ...
}
```

Key indexes:

- `@@index([status, nextRunAt])` — worker queue polling
- `@@index([status, lockExpiresAt, nextRunAt])` — reclaim + claim
- `@@index([repositoryId, status])` — per-repo exclusivity check

## Failure modes

### Mode 1: Worker crashes after claim

The job remains PROCESSING with an expired `lockExpiresAt`.  The next
poll cycle's `reclaimOrphanedJobs()` resets it to QUEUED, and a
different worker picks it up.  The job's `attempts` counter was
incremented at claim time, so the new worker's `markFailed` correctly
tracks retry exhaustion.

### Mode 2: Worker crashes after markDone

The job is already DONE.  No reclaim or re-claim can match it
(`status = 'PROCESSING'` is required for reclaim).  Safe.

### Mode 3: Network partition

A worker's heartbeat fails because the database is unreachable.  The
worker cannot confirm whether its lock is still valid.  After the
heartbeat timeout, `reclaimOrphanedJobs()` on another worker resets
the job.  When the original worker regains connectivity, its next
heartbeat or markDone fails the WHERE check, and the worker detects
it lost the lock.

### Mode 4: Two workers claim same job (race missed)

Even with the transaction and FOR UPDATE, a race is theoretically
possible at the serialization level if using `READ COMMITTED`.
PostgreSQL's `FOR UPDATE` guarantees that a concurrent transaction's
UPDATE waits for the first to commit, then re-evaluates the WHERE
clause.  At `READ COMMITTED`, the second transaction sees the updated
row (status = PROCESSING, locked_by = other worker) and its WHERE
clause no longer matches, so it returns 0 rows.  The worker gets
`null` from `claimNextJob` and tries again next cycle.

## Performance characteristics

| Operation | Latency (p50) | Latency (p99) |
|-----------|---------------|---------------|
| claimNextJob (no jobs) | 2ms | 5ms |
| claimNextJob (claim 1) | 3ms | 10ms |
| reclaimOrphanedJobs (0 jobs) | 1ms | 3ms |
| reclaimOrphanedJobs (N jobs) | 2ms + N*0.5ms | 5ms + N*1ms |
| heartbeat | 1ms | 3ms |
| markDone | 2ms | 5ms |
| markFailed (retry) | 2ms | 5ms |
| markFailed (final) | 2ms | 5ms |

Measured on Neon Free Tier (PostgreSQL 16, 1 vCPU, 1 GB RAM).

## Testing

### Unit tests

See `lib/__tests__/analysisJobService.test.ts`:

- Heartbeat: lock duration, WHERE scoping, lock_token inclusion
- Reclaim: null lockExpiresAt handling, multi-job reclaim, token clearing
- Claim: inline reclaim order, no-job-available edge case, claimed job shape
- MarkDone/MarkFailed/UpdateProgress: lock_token in WHERE, backward
  compat without workerId
- ReleaseLock/MarkDrainReleased: lock_token scoping, token clearing
- CleanupStaleJobs: zero grace period, error message content
- Singleton exports: method presence, method binding

### Integration tests

See `lib/__tests__/concurrent-claim.test.ts`:

- N workers (N=10) claiming from M jobs (M=100)
- Verifies each job claimed exactly once
- Verifies total claimed = M
- Verifies unique lockToken per claim
