import {
  generateWebhookKey,
  generateAiKey,
  tryAcquireIdempotency,
  getIdempotencyStatus,
  completeIdempotency,
  failIdempotency,
  isDuplicate,
  releaseIdempotency,
} from "../idempotency";

jest.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      async set(key: string, value: string, mode: string, ttl: number, nx: string) {
        if (nx === "NX" && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      },
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async del(key: string) {
        store.delete(key);
        return 1;
      },
    },
  };
});

describe("generateWebhookKey", () => {
  it("builds key from deliveryId, event, and action", () => {
    expect(generateWebhookKey("del-123", "pull_request", "opened")).toBe(
      "webhook:del-123:pull_request:opened",
    );
  });

  it("handles undefined action", () => {
    expect(generateWebhookKey("del-456", "push", undefined)).toBe(
      "webhook:del-456:push:none",
    );
  });
});

describe("generateAiKey", () => {
  it("builds key from repo, sha, and analysis type", () => {
    expect(generateAiKey("owner/repo", "abc123", "review")).toBe(
      "ai:owner/repo:abc123:review",
    );
  });
});

describe("idempotency lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("acquires a key on first attempt", async () => {
    const acquired = await tryAcquireIdempotency("test:key-1");
    expect(acquired).toBe(true);
  });

  it("detects duplicate on second attempt", async () => {
    const key = "test:key-2";
    expect(await tryAcquireIdempotency(key)).toBe(true);
    expect(await tryAcquireIdempotency(key)).toBe(false);
  });

  it("returns processing status after acquire", async () => {
    const key = "test:key-3";
    await tryAcquireIdempotency(key);
    expect(await getIdempotencyStatus(key)).toBe("processing");
  });

  it("returns completed status after completion", async () => {
    const key = "test:key-4";
    await tryAcquireIdempotency(key);
    await completeIdempotency(key);
    expect(await getIdempotencyStatus(key)).toBe("completed");
  });

  it("returns failed status after failure", async () => {
    const key = "test:key-5";
    await tryAcquireIdempotency(key);
    await failIdempotency(key);
    expect(await getIdempotencyStatus(key)).toBe("failed");
  });

  it("rejects duplicate for processing keys", async () => {
    const key = "test:key-6";
    await tryAcquireIdempotency(key);
    expect(await isDuplicate(key)).toBe(true);
  });

  it("rejects duplicate for completed keys", async () => {
    const key = "test:key-7";
    await tryAcquireIdempotency(key);
    await completeIdempotency(key);
    expect(await isDuplicate(key)).toBe(true);
  });

  it("allows re-acquire for failed keys", async () => {
    const key = "test:key-8";
    expect(await tryAcquireIdempotency(key)).toBe(true);
    await failIdempotency(key);
    expect(await tryAcquireIdempotency(key)).toBe(true);
  });

  it("returns null for unknown keys", async () => {
    expect(await getIdempotencyStatus("test:unknown")).toBeNull();
  });

  it("releases a key", async () => {
    const key = "test:key-9";
    await tryAcquireIdempotency(key);
    await releaseIdempotency(key);
    expect(await getIdempotencyStatus(key)).toBeNull();
  });

  it("handles empty deliveryId gracefully", async () => {
    const key = generateWebhookKey("", "pull_request", "opened");
    expect(key).toBe("webhook::pull_request:opened");
  });

  it("defaults action to none when undefined", async () => {
    expect(generateWebhookKey("del-1", "push", undefined)).toBe(
      "webhook:del-1:push:none",
    );
  });
});
