import redis from "@/lib/redis";

export type IdempotencyStatus = "processing" | "completed" | "failed";

export interface IdempotencyRecord {
  status: IdempotencyStatus;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TTL_MS = 86_400_000; // 24 hours
const PREFIX = "idemp";

function now(): string {
  return new Date().toISOString();
}

function redisKey(key: string): string {
  return `${PREFIX}:${key}`;
}

export function generateWebhookKey(deliveryId: string, event: string, action?: string): string {
  return `webhook:${deliveryId}:${event}:${action || "none"}`;
}

export function generateAiKey(repoFullName: string, headSha: string, analysisType: string): string {
  return `ai:${repoFullName}:${headSha}:${analysisType}`;
}

async function trySetRedis(key: string, ttlMs: number): Promise<boolean> {
  try {
    const record: IdempotencyRecord = { status: "processing", createdAt: now(), updatedAt: now() };
    const result = await redis.set(redisKey(key), JSON.stringify(record), "PX", ttlMs, "NX");
    return result === "OK";
  } catch {
    return false;
  }
}

async function getRedis(key: string): Promise<IdempotencyRecord | null> {
  try {
    const raw = await redis.get(redisKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

async function updateRedis(key: string, status: IdempotencyStatus): Promise<void> {
  try {
    const record: IdempotencyRecord = { status, createdAt: now(), updatedAt: now() };
    await redis.set(redisKey(key), JSON.stringify(record), "PX", DEFAULT_TTL_MS);
  } catch {
    // Silently fail – Redis unavailability should not break the app
  }
}

async function delRedis(key: string): Promise<void> {
  try {
    await redis.del(redisKey(key));
  } catch {
    // Silently fail
  }
}

const memoryStore = new Map<string, IdempotencyRecord>();

function trySetMemory(key: string, ttlMs: number): boolean {
  const storeKey = redisKey(key);
  if (memoryStore.has(storeKey)) {
    return false;
  }
  const record: IdempotencyRecord = { status: "processing", createdAt: now(), updatedAt: now() };
  memoryStore.set(storeKey, record);
  setTimeout(() => memoryStore.delete(storeKey), ttlMs);
  return true;
}

function getMemory(key: string): IdempotencyRecord | null {
  return memoryStore.get(redisKey(key)) ?? null;
}

function updateMemory(key: string, status: IdempotencyStatus): void {
  const storeKey = redisKey(key);
  const existing = memoryStore.get(storeKey);
  if (existing) {
    existing.status = status;
    existing.updatedAt = now();
  }
}

export async function tryAcquireIdempotency(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<boolean> {
  const acquired = await trySetRedis(key, ttlMs);
  if (acquired) return true;

  const record = await getRedis(key);
  if (!record) {
    return trySetMemory(key, ttlMs);
  }

  if (record.status === "processing" || record.status === "completed") {
    return false;
  }

  const reAcquired = await trySetRedis(key, ttlMs);
  if (reAcquired) return true;
  return trySetMemory(key, ttlMs);
}

export async function completeIdempotency(key: string): Promise<void> {
  await updateRedis(key, "completed");
  updateMemory(key, "completed");
}

export async function failIdempotency(key: string): Promise<void> {
  await updateRedis(key, "failed");
  updateMemory(key, "failed");
}

export async function getIdempotencyStatus(key: string): Promise<IdempotencyStatus | null> {
  const record = await getRedis(key);
  if (record) return record.status;
  return getMemory(key)?.status ?? null;
}

export async function isDuplicate(key: string): Promise<boolean> {
  const status = await getIdempotencyStatus(key);
  return status === "processing" || status === "completed";
}

export async function releaseIdempotency(key: string): Promise<void> {
  await delRedis(key);
}
