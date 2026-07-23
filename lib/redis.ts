import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) {
      console.error("[Redis] Max reconnection attempts reached — giving up");
      return null;
    }
    const delay = Math.min(times * 200, 5000);
    console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  enableReadyCheck: true,
  lazyConnect: false,
  connectTimeout: 10000,
  disconnectTimeout: 5000,
  keepAlive: 30000,
});

connection.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

connection.on("reconnecting", (delay: number) => {
  console.warn(`[Redis] Reconnecting in ${delay}ms...`);
});

connection.on("ready", () => {
  console.log("[Redis] Connected and ready");
});

connection.on("close", () => {
  console.warn("[Redis] Connection closed");
});

process.once("beforeExit", async () => {
  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
});

export default connection;
