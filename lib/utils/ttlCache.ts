/**
 * Lightweight in-process TTL cache.
 *
 * Designed for Next.js API routes running in a long-lived Node.js process
 * (local dev, Docker, Cloud Run). Each entry carries its own expiry timestamp
 * so lookups are O(1) and no background timer is needed.
 *
 * Usage
 * ─────
 *   import { ttlCache } from "@/lib/utils/ttlCache";
 *
 *   // Store a value for 5 minutes
 *   ttlCache.set("repo-stats:42:7", data, 5 * 60 * 1000);
 *
 *   // Retrieve (returns undefined if missing or expired)
 *   const cached = ttlCache.get<MyType>("repo-stats:42:7");
 *
 *   // Invalidate a single key
 *   ttlCache.delete("repo-stats:42:7");
 *
 *   // Invalidate all keys that start with a prefix
 *   ttlCache.deleteByPrefix("repo-stats:42:");
 *
 * Notes
 * ─────
 * - This is a single-process cache. In a multi-replica deployment each
 *   replica has its own cache; invalidation only affects the local replica.
 *   For multi-replica consistency, replace the backing store with Redis or
 *   a similar shared cache.
 * - Expired entries are evicted lazily on read and eagerly during periodic
 *   sweeps (every `SWEEP_INTERVAL_MS`).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix ms
}

/** How often to sweep and remove expired entries (default: 2 minutes). */
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Only schedule the sweep in a real Node.js environment (not during
    // Next.js build-time static analysis or edge runtime).
    if (
      typeof setInterval !== "undefined" &&
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "test"
    ) {
      this.sweepTimer = setInterval(
        () => this.sweep(),
        SWEEP_INTERVAL_MS
      );
      // Don't keep the process alive just for cache sweeps.
      if (this.sweepTimer.unref) {
        this.sweepTimer.unref();
      }
    }
  }

  /**
   * Store `value` under `key` for `ttlMs` milliseconds.
   * Overwrites any existing entry for the same key.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Retrieve the cached value for `key`.
   * Returns `undefined` if the key does not exist or has expired.
   * Expired entries are evicted on access.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Remove the entry for `key` (no-op if it does not exist).
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove all entries whose key starts with `prefix`.
   * Useful for invalidating all cached stats for a given repository:
   *   ttlCache.deleteByPrefix(`repo-stats:${repoId}:`)
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Number of entries currently in the cache (including expired ones not yet swept). */
  get size(): number {
    return this.store.size;
  }

  /** Remove all expired entries. Called automatically on a timer. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Singleton cache instance shared across all API route handlers in this
 * process. Import and use this directly — do not instantiate TtlCache yourself.
 */
export const ttlCache = new TtlCache();

/** TTL constants for common use cases. */
export const TTL = {
  /** 5 minutes — default for repo stats. */
  REPO_STATS: 5 * 60 * 1000,
  /** 1 minute — for more volatile data. */
  SHORT: 60 * 1000,
  /** 10 minutes — for slower-changing data. */
  LONG: 10 * 60 * 1000,
} as const;

/** Build a cache key for repository stats. */
export function repoStatsCacheKey(repoId: number, userId: number): string {
  return `repo-stats:${repoId}:${userId}`;
}
