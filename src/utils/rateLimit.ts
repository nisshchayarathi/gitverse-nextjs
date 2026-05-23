const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
let lastCleanupAt = 0;

const DEFAULT_WINDOW_MS = 900_000;
const DEFAULT_MAX_REQUESTS = 5;

export function checkRateLimit(ip: string) {
  // 1. Safely parse environment variables with fallbacks
  const parsedWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '', 10);
  const parsedMaxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '', 10);

  const windowMs = Number.isInteger(parsedWindowMs) && parsedWindowMs > 0 
    ? parsedWindowMs 
    : DEFAULT_WINDOW_MS;

  const maxRequests = Number.isInteger(parsedMaxRequests) && parsedMaxRequests > 0 
    ? parsedMaxRequests 
    : DEFAULT_MAX_REQUESTS;

  const now = Date.now();

  // 2. Periodically prune expired entries to bound memory growth
  if (now - lastCleanupAt >= windowMs) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.expiresAt <= now) rateLimitMap.delete(key);
    }
    lastCleanupAt = now;
  }

  const record = rateLimitMap.get(ip);

  // 3. Apply rate limit logic
  if (!record || record.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return { success: true };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.expiresAt - now) / 1000);
    return { success: false, retryAfter: retryAfterSeconds };
  }

  record.count += 1;
  rateLimitMap.set(ip, record);
  return { success: true };
}