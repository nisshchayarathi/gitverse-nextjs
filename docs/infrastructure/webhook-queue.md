# Webhook Queue Infrastructure

## Overview

The webhook queue system processes incoming GitHub and incident webhooks asynchronously. Events are persisted to PostgreSQL immediately and queued via BullMQ for background processing by workers. This document covers the architecture, the data flow trace, the failure modes of the legacy design, and operational guidance.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │  GitHub / Incident Webhook POST  │
                    │  /api/integrations/*/webhook     │
                    └──────────────┬──────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────┐
                    │  WebhookQueueService             │
                    │  enqueueWebhook()                 │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
          ┌─────────────────┐ ┌──────────┐ ┌──────────────┐
          │ deliveryId      │ │ Prisma   │ │ BullMQ       │
          │ dedup check     │ │ create   │ │ addBulk()    │
          │ (findFirst)     │ │ Webhook  │ │ → Worker     │
          └─────────────────┘ │ Event    │ └──────────────┘
                              └──────────┘
```

## Data Flow Trace

A complete trace through the system for a GitHub `push` event:

```
1. POST /api/integrations/github/webhook
   Headers:
     x-github-event: push
     x-github-delivery: abc123-...
     x-hub-signature-256: sha256=...

2. getClientIp(request)                    → extract source IP

3. checkRateLimit(ip, GITHUB_WEBHOOK)      → Redis multi/exec for sliding-window
   │
   ├── fallbackFailed?                      → write DLQ row to webhook_events → 202
   ├── !allowed?                            → 429 rate limit response
   └── allowed                              → proceed

4. verifyGitHubWebhookSignature()           → HMAC-SHA256 against GITHUB_WEBHOOK_SECRET
   │
   ├── invalid                             → 401
   └── valid                               → proceed

5. Event routing:
   │
   ├── event ∉ {pull_request, issues, push} → 200 { ignored: true }
   ├── event = pull_request:
   │     action ∉ {opened,reopened,synchronize,ready_for_review} → 200 { ignored: true }
   │     pull_request.draft=true && action≠ready_for_review      → 200 { ignored: true }
   ├── event = issues:
   │     action ≠ opened                                        → 200 { ignored: true }
   └── event = push                                             → accept all

6. sender.type === "Bot"                   → 200 { ignored: true }  (no feedback loops)

7. Field validation                        → missing fields → 400

8. Redis idempotency lock:
   deliveryId present?
   ├── yes: tryAcquireIdempotency(key)     → SET NX EX 30
   │     └── acquired=false → 200 { ignored: true, reason: "duplicate_delivery" }
   └── no:  skip

9. webhookQueue.enqueueWebhook(payload, event, action, baseUrl, deliveryId)
   │
   ├── deliveryId present?
   │     ├── yes: prisma.webhookEvent.findFirst({ where: { deliveryId } })
   │     │     └── exists? → log + return (DB-level dedup)
   │     └── no:  skip
   │
   ├── prisma.webhookEvent.create({ ... status: "pending" })
   │     └── returns { id: "uuid-..." }
   │
   └── webhookQueueInstance.addBulk([{ name: "process-webhook", data: { eventId } }])
         └── BullMQ job (Redis LPUSH)

10. webhookRetryService.requeueFailedJobs()  → fire-and-forget

11. Return 202 { ok: true }
```

### Worker Side (BullMQ)

```
12. BullMQ worker picks up "process-webhook" job
    │
    ├── prisma.webhookEvent.update({ status: "processing" })
    ├── ... process the event (GitHub API calls, analysis, etc.) ...
    ├── prisma.webhookEvent.update({ status: "completed" })
    └── Job acknowledged

    On failure:
    ├── Job retries (exponential backoff, 5 max attempts)
    ├── prisma.webhookEvent.update({ status: "failed", error, retryCount++ })
    └── On final failure → webhook_events row stays in "failed" for manual DLQ inspection
```

## Legacy Design Analysis

### What Existed Before

The previous implementation at `lib/services/webhook-queue.ts` used a global mutable buffer:

```ts
const globalForQueue = globalThis as unknown as {
  webhookBuffer: QueuedWebhook[];
  webhookFlushTimeout: NodeJS.Timeout | null;
};

enqueueWebhook() {
  globalForQueue.webhookBuffer.push({ ... });
  if (!globalForQueue.webhookFlushTimeout) {
    globalForQueue.webhookFlushTimeout = setTimeout(() => {
      this.flushWebhooks(baseUrl).catch(console.error);
    }, 500);
  }
}

flushWebhooks() {
  const batch = globalForQueue.webhookBuffer.splice(0, ...);
  // ... Prisma transaction ...
  // ... BullMQ sequential enqueue ...
}
```

### Failure Mode A — Serverless Termination

On Vercel (deployed per `vercel.json`), the serverless runtime can freeze or terminate the Node.js process at any point after the HTTP response headers are flushed. In the legacy design:

1. GitHub sends webhook → handler calls `enqueueWebhook()` → returns 200
2. Event sits in `globalForQueue.webhookBuffer`
3. `setTimeout(fn, 500)` is scheduled but the event loop drains before 500 ms
4. Vercel freezes the function
5. The timeout never fires
6. The buffered event is permanently lost
7. GitHub marks delivery as successful (received 200) — no automatic retry

This is not hypothetical. Vercel's serverless documentation explicitly states: "After the response is sent, the function enters a 'draining' state where no new events are processed, and the function is frozen once the event loop is empty."

### Failure Mode B — Concurrent Splice Race

If two HTTP requests complete within the same 500 ms window:

1. Request A calls `enqueueWebhook()` → buffer.push → schedule timeout
2. Request B calls `enqueueWebhook()` → buffer.push → timeout already exists
3. 500 ms fires → `flushWebhooks()` called for the first time
4. `splice(0, buffer.length)` extracts events from both requests
5. Before the Prisma transaction completes, a third request C arrives
6. If the timeout was set to null (line 47) but an event arrives between the splice and the timeout reset, that event is never flushed

### Failure Mode C — Unshift on Error Puts Retries Ahead of New Events

When `flushWebhooks` fails (line 66-76), events are pushed back to the front with `.unshift(...batch)`. If the flush repeatedly fails:

1. Five events are in the buffer: `[A, B, C, D, E]`
2. Flush fails for A, B → `.unshift([A, B])` → buffer becomes `[A, B, C, D, E, A, B]`
3. New event F arrives via `.push` → buffer becomes `[A, B, C, D, E, A, B, F]`
4. Retry events A, B stay at the front, blocking newer events from being processed
5. If the flush continues to fail, A and B are retried indefinitely, consuming the entire retry window

### Failure Mode D — Missing deliveryId Dedup

The `WebhookEvent` schema has a `deliveryId` field with an index, but the legacy `enqueueWebhook` never checked for existing events with the same `deliveryId`. GitHub guarantees that webhooks may be redelivered (same `X-GitHub-Delivery` header), so duplicate events were silently created.

### Failure Mode E — Sequential BullMQ Enqueue

Lines 63-64 of the legacy code:

```ts
for (const event of createdEvents) {
  await webhookQueueInstance.add("process-webhook", { eventId: event.id });
}
```

This sends N sequential `await` calls to Redis. Each `.add()` is a separate round-trip. For a batch of 50 events, this means 50 sequential Redis calls holding the Node.js event loop. BullMQ provides `.addBulk()` which accepts an array of jobs and sends them in a single Redis command.

## The Fix

### Changes Applied

| File | Change |
|------|--------|
| `lib/services/webhook-queue.ts` | Removed `QueuedWebhook` type, `globalForQueue` mutable state, `flushWebhooks()` method. `enqueueWebhook()` is now `async`: dedup via `findFirst` → `prisma.webhookEvent.create` → `addBulk()`. |
| `app/api/integrations/github/webhook/route.ts` | `await` the async `enqueueWebhook` call. Added section-comment blocks for each handler phase. |
| `lib/services/__tests__/webhook-queue.test.ts` | 25 tests: 3 new enqueue-dedup tests + 22 updated tests. Mock `findFirst`, `create`, `addBulk`. |
| `docs/infrastructure/webhook-queue.md` | This document. |

### Key Design Decisions

1. **Direct DB write, no buffer**: `enqueueWebhook` creates the `WebhookEvent` row synchronously within the request. The HTTP response is not sent until the event is durable in PostgreSQL.

2. **Two-layer idempotency**: Redis lock (in the route handler) for atomic claim, database `findFirst` check (in the service) for defense-in-depth. The Redis lock prevents concurrent duplicate processing; the DB check catches cases where the lock expired or was missed.

3. **addBulk for single events too**: Even single events go through `.addBulk([job])`. This keeps the code path consistent and prevents a future regression where a `for-await` loop could be reintroduced.

4. **No global state**: Every invocation of `enqueueWebhook` is self-contained. No `globalThis`, no `setTimeout`, no shared buffer. The service is stateless between requests.

## Performance Characteristics

### Latency

The critical-path latency of `enqueueWebhook` is dominated by two sequential I/O operations:

1. `findFirst` (if deliveryId present): index scan on `webhook_events.deliveryId` — ~2-5 ms
2. `create`: INSERT returning `id` — ~5-15 ms
3. `addBulk`: Redis LPUSH — ~1-3 ms

Total: roughly 10-25 ms added to the request. This is acceptable for a webhook endpoint that has no user-facing latency requirement. The previous design deferred this work to a background timeout, but at the cost of data-loss risk.

### Throughput

- PostgreSQL handles the write volume comfortably (webhooks are typically <10/sec per installation).
- BullMQ's `.addBulk()` uses a single Redis round-trip, so job enqueue throughput is bounded by Redis latency (~50k ops/sec per Redis instance).
- The route handler's rate limiter (`RATE_LIMITS.GITHUB_WEBHOOK`) prevents throughput spikes from overwhelming the database.

## Comparison: Legacy vs Current

| Aspect | Legacy | Current |
|--------|--------|---------|
| Durability | None (in-memory buffer) | PostgreSQL (durable on commit) |
| Write timing | Deferred by 500 ms | Synchronous within request |
| Serverless safety | Lost on termination | Safe (write completes before response) |
| Concurrent safety | Splice race | No shared state |
| deliveryId dedup | None | `findFirst` + Redis lock |
| BullMQ enqueue | Sequential for-await | `addBulk` (one round-trip) |
| Retry on error | Buffer unshift (reordering) | Error thrown to caller (HTTP 500) |
| Global state | `globalThis.webhookBuffer` | None |
| Test coverage | 22 tests | 25 tests |

## Monitoring and Alerting

### Key Metrics

| Metric | Source | What to Watch For |
|--------|--------|-------------------|
| `webhook_events` rows created/min | PostgreSQL | Spikes indicate webhook storms |
| `webhook_events` status=failed | PostgreSQL | Processing failures needing inspection |
| `webhook_events` status=dlq | PostgreSQL | Rate limiter systemic failure |
| BullMQ waiting jobs | Redis / BullMQ dashboard | Queue backlog growth |
| BullMQ failed jobs | Redis / BullMQ dashboard | Worker crashes or logic errors |

### Log Messages

| Log line | Source | Meaning |
|----------|--------|---------|
| `[WebhookQueue] Duplicate deliveryId ...` | `webhook-queue.ts` | Dedup at service layer (expected) |
| `[WebhookRoute] ... DLQing webhook` | `route.ts` | Rate limiter completely failed |
| `[WebhookRoute] Error queueing webhook event` | `route.ts` | DB write or Redis enqueue failed |
| `[BullMQ] ...` | `webhookQueue.ts` worker | Job processing events |

## Disaster Recovery

### Manual DLQ Inspection

```sql
SELECT id, event, action, error, retry_count, created_at
FROM webhook_events
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 100;

-- Re-enqueue a specific failed event:
-- (copy the id and call the internal worker route)
```

### Re-enqueue via Internal Worker

```bash
curl -X POST https://your-app.vercel.app/api/internal/worker/webhook \
  -H "Authorization: Bearer $INTERNAL_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"eventId": "uuid-from-failed-event"}'
```

### Data Integrity Check

```sql
-- Check for duplicate deliveryIds (should not happen)
SELECT delivery_id, COUNT(*) as cnt
FROM webhook_events
WHERE delivery_id IS NOT NULL
GROUP BY delivery_id
HAVING COUNT(*) > 1;

-- Check for events stuck in "pending" for too long
SELECT COUNT(*), MIN(created_at), MAX(created_at)
FROM webhook_events
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour';
```

## Related Files

- `lib/services/webhook-queue.ts` — Core service implementation (59 lines)
- `lib/queue/webhookQueue.ts` — BullMQ queue configuration (20 lines)
- `app/api/integrations/github/webhook/route.ts` — GitHub webhook endpoint (218 lines)
- `app/api/integrations/incidents/webhook/route.ts` — Incident webhook endpoint (136 lines)
- `app/api/internal/worker/webhook/route.ts` — Internal worker enqueue endpoint (53 lines)
- `lib/services/__tests__/webhook-queue.test.ts` — Test suite (107 lines)
- `lib/prisma.ts` — Prisma client with connection pooling and retry logic (318 lines)
- `prisma/schema.prisma` — `WebhookEvent` model definition at line 540

## References

- GitHub issue #1962: original bug report and root cause analysis
- BullMQ documentation: `.addBulk()` for batch job enqueue
- Vercel serverless runtime documentation: function lifecycle and termination behavior
