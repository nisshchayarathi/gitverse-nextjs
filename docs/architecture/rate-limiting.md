# Rate Limiting Architecture

## Overview

GitVerse uses a three-layer rate limiting system to protect API endpoints from abuse while remaining resilient to database failures.

```
Request → checkRateLimit() → DB Upsert (atomic)
                            → Circuit Breaker (fault isolation)
                            → LRU Cache (last resort fallback)
```

## Layer 1 — Atomic Database Upsert (Primary)

Every rate-limited endpoint calls `checkRateLimit(identifier, config)` which builds a composite key `namespace:identifier` and computes a fixed-window expiry aligned to the nearest clock boundary.

```typescript
// lib/middleware/rateLimit.ts — checkRateLimit
const key = `${config.namespace}:${identifier}`;
const expiresAt = getWindowExpiry(Date.now(), config.windowMs);
// rounds to: Math.floor(now / windowMs) * windowMs + windowMs
```

The actual rate limit check is a single `prisma.rateLimit.upsert()` call:

```typescript
await prisma.rateLimit.upsert({
  where: { key_expiresAt: { key, expiresAt } },
  update: { points: { increment: 1 } },
  create: { key, points: 1, expiresAt },
});
```

Because `(key, expiresAt)` has a `@@unique` constraint, the database guarantees
atomicity — two concurrent requests cannot both see the same count.  If a
duplicate key violation still occurs (e.g. a Prisma driver retry), the P2002
catch block rejects the request.

### Fixed-Window vs Sliding Window

The old implementation used a sliding window: each request created a new row
with `expiresAt = now + windowMs`, and the count queried all rows where
`expiresAt >= now`.  This made atomic upsert impossible because every request
had a unique `expiresAt`.

The new implementation uses a fixed window: all requests within the same clock
interval (e.g. 12:00:00–12:00:59 for a 60-second window) share the same
`expiresAt` value.  This enables a single upsert target per window.

## Layer 2 — Circuit Breaker

The upsert call is wrapped in an opossum circuit breaker (`dbLimiterCircuit`)
that protects the database from cascading failures:

- **Timeout**: 3 seconds per upsert call
- **Error threshold**: 50% — opens after half the requests in a sampling window fail
- **Reset timeout**: 10 seconds — after which one trial request is allowed

When the circuit is open, `checkRateLimit` catches the error and falls through
to Layer 3 instead of blocking the request.

## Layer 3 — LRU Cache Fallback

The in-memory LRU cache (`fallbackCache`) acts as a safety net when the
database is unreachable or the circuit breaker is open:

- **Size**: 10,000 entries
- **TTL**: 1 hour (per-entry)
- **Behavior**: Fail-open — allows requests through but tracks the count
  locally so the limit is still enforced

If the LRU cache itself throws (extremely rare), the function returns
`{ allowed: false, fallbackFailed: true }` to signal downstream systems.

## Database Schema

```prisma
model RateLimit {
  id        String   @id @default(uuid()) @db.Uuid
  key       String
  points    Int      @default(0)
  expiresAt DateTime @map("expires_at")

  @@unique([key, expiresAt])
  @@index([key])
  @@index([expiresAt], name: "rate_limits_expires_at_idx")
  @@map("rate_limits")
}
```

The `@@unique([key, expiresAt])` constraint is the foundation of the atomicity
guarantee.  Without it, the P2002 catch in `checkRateLimit` would never fire
and the upsert would silently create duplicate rows.

## Migration from Sliding Window

Migration `20260606000000_atomic_rate_limit_upsert` handles existing data:

1. Sums `points` across duplicate `(key, expires_at)` rows into the oldest row
2. Deletes the surplus rows per group
3. Drops the old `@@index([key, expiresAt])`
4. Adds `@@unique([key, expiresAt])`

This migration is safe to run on a production database.  The cleanup cron at
`/api/cron/rate-limit-cleanup` continues to delete expired rows as before.

## Testing Strategy

- **rateLimit.test.ts** — Unit tests for `checkRateLimit`, rate limit headers,
  and RATE_LIMITS configuration (mock DB layer)
- **rateLimitAtomic.test.ts** — Tests that verify atomicity: only upsert is
  called (no separate count + create), fixed-window behaviour, circuit breaker
  recovery, and concurrent request handling
- **Downstream route tests** — 31 route files that mock `checkRateLimit`
  continue to pass without modification because the function signature is
  unchanged

## Error Handling Matrix

| Scenario | Behavior | HTTP Code |
|---|---|---|
| Under limit | Allowed | 200 (proceed) |
| At or over limit | Denied | 429 |
| P2002 unique violation | Denied (race loser) | 429 |
| DB timeout / connection error | LRU fallback | 200 (degraded) |
| Both DB and LRU fail | Denied with `fallbackFailed: true` | 429 |
| Circuit breaker open | LRU fallback | 200 (degraded) |

## Configuration

Rate limit configurations are defined in `RATE_LIMITS` in
`lib/middleware/rateLimit.ts`.  Each entry specifies:

- `namespace` — A unique string prefix for the rate limit key
- `maxRequests` — Maximum requests allowed in the window
- `windowMs` — Duration of the window in milliseconds

## Troubleshooting

### Rate limit not enforced under load

If you see requests exceeding the configured limit, verify the `@@unique` constraint
exists on the `rate_limits` table:

```sql
SELECT conname, contype
FROM   pg_constraint
WHERE  conrelid = 'rate_limits'::regclass;
```

Expected output: `rate_limits_key_expires_at_key` with `contype = 'u'`.
If the constraint is missing, run the pending migration.

### P2002 errors in production logs

A small number of P2002 errors is expected and harmless — they occur when
two concurrent requests race on the same upsert and the second one hits the
unique constraint.  This is the correct behaviour: the loser is rejected with
a 429.

If P2002 errors are frequent (>1% of requests), the configured limit may be
too low for legitimate traffic.  Consider increasing `maxRequests` or reducing
the number of endpoints sharing the same namespace.

### Circuit breaker opening frequently

The circuit opens when >50% of upsert calls fail within the sampling window.
Common causes:

- Database connection pool exhausted under high concurrency
- Neon/Postgres cold start after scale-to-zero
- Network latency exceeding the 3-second timeout

Check `PG_POOL_MAX` in your environment and consider increasing it if the
circuit opens under normal traffic patterns.  The LRU fallback will keep
requests flowing, but limits are enforced in-memory and reset on server
restart.

### LRU fallback is not persisted

When the server restarts, the in-memory LRU cache is cleared.  If the
database was unavailable at the time, rate limit state is lost and clients
may briefly exceed their limit until the DB recovers and the upsert path
resumes.

This is a deliberate trade-off: the circuit breaker's `resetTimeout`
(10 seconds) ensures the DB is re-tried quickly, at which point the
rate limit state is restored from the database.

