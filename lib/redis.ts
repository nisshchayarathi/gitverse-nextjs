import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  // In development without Redis, stop retrying after a few attempts
  // to avoid flooding the console. The rate limiter and queue already
  // fail open / handle disconnection gracefully.
  retryStrategy(times) {
    if (!process.env.REDIS_URL && process.env.NODE_ENV !== "production") {
      // No REDIS_URL configured — stop retrying after 3 attempts in dev
      if (times > 3) return null;
    }
    // Exponential backoff: 50ms, 100ms, 200ms... up to 2s
    return Math.min(times * 50, 2000);
  },
  reconnectOnError() {
    // Only reconnect on specific errors, not ECONNREFUSED
    return false;
  },
});

connection.on("error", (err) => {
  // Only log once when Redis is unavailable, not on every retry
  if ((err as any).code === "ECONNREFUSED") {
    if (!process.env.REDIS_URL) {
      // Suppress — expected when running without Redis locally
      return;
    }
  }
  console.error("[Redis] Connection error:", err.message);
});

export default connection;
