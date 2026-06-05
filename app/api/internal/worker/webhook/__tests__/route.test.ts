/**
 * @jest-environment node
 */

jest.mock("@/lib/middleware/rateLimit", () => ({
  checkRateLimit: jest.fn(),
  rateLimitResponse: jest.fn((_result: any, message?: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: true, message: message ?? "Too many requests. Please wait before retrying.", code: 429 },
      { status: 429 }
    );
  }),
  RATE_LIMITS: {
    WORKER_WEBHOOK: { namespace: "worker:webhook", maxRequests: 50, windowMs: 60000 },
  },
}));

jest.mock("@/lib/utils/internalAuth", () => ({
  isInternalWorkerAuthorized: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/services/webhook-queue", () => ({
  webhookQueue: {
    triggerWorkers: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    webhookEvent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gitHubRepo: {
      findFirst: jest.fn(),
    },
  },
}));

import { POST } from "../route";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import { checkRateLimit } from "@/lib/middleware/rateLimit";
import { webhookQueue } from "@/lib/services/webhook-queue";
import { NextRequest } from "next/server";

function mockRequest(overrides?: {
  authHeader?: string;
  body?: any;
  headers?: Record<string, string>;
}): NextRequest {
  const authHeader = overrides?.authHeader;
  const extraHeaders = overrides?.headers ?? {};
  const headersMap = new Map<string, string>();
  if (authHeader) headersMap.set("authorization", authHeader);
  for (const [k, v] of Object.entries(extraHeaders)) {
    headersMap.set(k.toLowerCase(), v);
  }
  return {
    headers: headersMap,
    json: jest.fn().mockResolvedValue(overrides?.body ?? {}),
    nextUrl: new URL("http://localhost:3000/api/internal/worker/webhook"),
  } as unknown as NextRequest;
}

function asMock<T>(fn: T): jest.Mock {
  return fn as any;
}

function rateLimitedResult(overrides?: Partial<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}>): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  return {
    allowed: overrides?.allowed ?? true,
    remaining: overrides?.remaining ?? 49,
    resetAt: overrides?.resetAt ?? Date.now() + 60000,
    limit: overrides?.limit ?? 50,
  };
}

const validEvent = {
  id: "evt-001",
  status: "pending",
  retryCount: 0,
  maxRetries: 3,
  payload: {
    repository: { owner: { login: "owner" }, name: "repo" },
    pull_request: { number: 42 },
    installation: { id: 123 },
  },
  event: "pull_request",
  action: "opened",
};

const processingEvent = {
  ...validEvent,
  id: "evt-002",
  status: "processing",
};

const completedEvent = {
  ...validEvent,
  id: "evt-003",
  status: "completed",
};

describe("POST /api/internal/worker/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_WORKER_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    asMock(checkRateLimit).mockResolvedValue(rateLimitedResult({ allowed: true }));
  });

  afterEach(() => {
    delete process.env.INTERNAL_WORKER_SECRET;
    delete process.env.NEXTAUTH_URL;
  });

  describe("authentication ordering", () => {
    it("returns 401 when no auth header is provided", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest());
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when auth header is invalid", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest({ authHeader: "Bearer invalid-secret" }));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("authenticates before checking rate limit", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      await POST(mockRequest());

      expect(asMock(checkRateLimit)).not.toHaveBeenCalled();
    });

    it("does not consume rate limit on auth failure", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest());

      expect(res.status).toBe(401);
      expect(asMock(checkRateLimit)).not.toHaveBeenCalled();
    });

    it("does not call triggerWorkers on auth failure", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      await POST(mockRequest());

      expect(asMock(webhookQueue.triggerWorkers)).not.toHaveBeenCalled();
    });

    it("isInternalWorkerAuthorized is called with the authorization header", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      await POST(mockRequest({ authHeader: "Bearer some-token" }));

      expect(asMock(isInternalWorkerAuthorized)).toHaveBeenCalledWith("Bearer some-token");
    });

    it("returns 401 when INTERNAL_WORKER_SECRET is not set", async () => {
      delete process.env.INTERNAL_WORKER_SECRET;
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest({ authHeader: "Bearer test-secret" }));

      expect(res.status).toBe(401);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit exceeded", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: false, remaining: 0 })
      );

      const res = await POST(mockRequest({ authHeader: "Bearer valid-token" }));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("passes through when rate limit is within bounds", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: true, remaining: 30 })
      );

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      expect(res.status).toBe(200);
    });

    it("uses the correct rate limit key", async () => {
      await POST(mockRequest({ authHeader: "Bearer valid-token" }));

      expect(asMock(checkRateLimit)).toHaveBeenCalledWith(
        "webhook-worker",
        expect.objectContaining({
          namespace: "worker:webhook",
          maxRequests: 50,
          windowMs: 60000,
        })
      );
    });

    it("does not use x-worker-id header for rate limiting", async () => {
      await POST(
        mockRequest({
          authHeader: "Bearer valid-token",
          headers: { "x-worker-id": "attacker-controlled-value" },
        })
      );

      expect(asMock(checkRateLimit)).toHaveBeenCalledWith(
        "webhook-worker",
        expect.any(Object)
      );
      expect(asMock(checkRateLimit)).not.toHaveBeenCalledWith(
        "attacker-controlled-value",
        expect.any(Object)
      );
    });

    it("rate limit check happens only after auth succeeds", async () => {
      const authOrder: string[] = [];
      asMock(isInternalWorkerAuthorized).mockImplementation(() => {
        authOrder.push("auth");
        return true;
      });
      asMock(checkRateLimit).mockImplementation(async () => {
        authOrder.push("rateLimit");
        return rateLimitedResult({ allowed: true });
      });

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } }));

      expect(authOrder).toEqual(["auth", "rateLimit"]);
    });

    it("rate limited response includes error message", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: false, remaining: 0 })
      );

      const res = await POST(mockRequest({ authHeader: "Bearer valid-token" }));
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body).toHaveProperty("error", true);
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("code", 429);
    });
  });

  describe("event validation", () => {
    it("returns 400 when eventId is missing from body", async () => {
      const res = await POST(mockRequest({ authHeader: "Bearer valid-token" }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("eventId is required");
    });

    it("returns 400 when eventId is null", async () => {
      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: null } })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("eventId is required");
    });

    it("returns 400 when eventId is empty string", async () => {
      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "" } })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("eventId is required");
    });

    it("returns 400 when body is malformed JSON", async () => {
      const req = mockRequest({ authHeader: "Bearer valid-token" });
      asMock(req.json).mockRejectedValueOnce(new Error("Unexpected token"));

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("eventId is required");
    });

    it("returns 404 when event is not found", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "nonexistent" } })
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe("Event not found");
    });

    it("returns 200 with ignored when event already processed", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(completedEvent);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-003" } })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ignored).toBe(true);
      expect(body.reason).toBe("already_processed");
    });

    it("returns 200 with ignored when event is currently processing", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(processingEvent);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-002" } })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ignored).toBe(true);
      expect(body.reason).toBe("already_processed");
    });

    it("calls webhookEvent.findUnique with correct eventId", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null);

      await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "test-event-123" } })
      );

      expect(asMock(prisma.webhookEvent.findUnique)).toHaveBeenCalledWith({
        where: { id: "test-event-123" },
      });
    });

    it("marks event as processing before proceeding", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      expect(asMock(prisma.webhookEvent.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-001" },
          data: { status: "processing" },
        })
      );
    });
  });

  describe("triggerWorkers behavior", () => {
    it("calls triggerWorkers after successful authentication and processing", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } }));

      expect(asMock(webhookQueue.triggerWorkers)).toHaveBeenCalledTimes(1);
    });

    it("calls triggerWorkers even when handlePost throws an error", async () => {
      const prisma = require("@/lib/prisma").default;
      const dbError = new Error("Database connection failed");
      asMock(prisma.webhookEvent.findUnique).mockRejectedValueOnce(dbError);

      await expect(
        POST(mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } }))
      ).rejects.toThrow("Database connection failed");

      expect(asMock(webhookQueue.triggerWorkers)).toHaveBeenCalledTimes(1);
    });

    it("does not throw when triggerWorkers itself fails", async () => {
      asMock(webhookQueue.triggerWorkers).mockRejectedValueOnce(new Error("Queue error"));

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await expect(
        POST(mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } }))
      ).resolves.not.toThrow();
    });

    it("calls triggerWorkers with the correct base URL", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      process.env.NEXTAUTH_URL = "https://app.gitverse.ai";

      await POST(mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } }));

      expect(asMock(webhookQueue.triggerWorkers)).toHaveBeenCalledWith("https://app.gitverse.ai");
    });

    it("falls back to host header for base URL when NEXTAUTH_URL is not set", async () => {
      delete process.env.NEXTAUTH_URL;

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(
        mockRequest({
          authHeader: "Bearer valid-token",
          body: { eventId: "evt-001" },
          headers: { host: "api.gitverse.ai" },
        })
      );

      expect(asMock(webhookQueue.triggerWorkers)).toHaveBeenCalledWith("http://api.gitverse.ai");
    });

    it("does not call triggerWorkers when auth fails", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      await POST(mockRequest({ authHeader: "Bearer invalid" }));

      expect(asMock(webhookQueue.triggerWorkers)).not.toHaveBeenCalled();
    });

    it("does not call triggerWorkers when rate limited", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: false, remaining: 0 })
      );

      await POST(mockRequest({ authHeader: "Bearer valid-token" }));

      expect(asMock(webhookQueue.triggerWorkers)).not.toHaveBeenCalled();
    });
  });

  describe("repo not enabled handling", () => {
    it("returns 200 with ignored when repo is not enabled", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update)
        .mockResolvedValueOnce({ ...validEvent, status: "processing" })
        .mockResolvedValueOnce({ ...validEvent, status: "completed" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ignored).toBe(true);
      expect(body.reason).toBe("repo_not_enabled");
    });

    it("updates event status to completed when repo not enabled", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update)
        .mockResolvedValueOnce({ ...validEvent, status: "processing" })
        .mockResolvedValueOnce({ ...validEvent, status: "completed" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      const updateCalls = asMock(prisma.webhookEvent.update).mock.calls;
      const completedUpdate = updateCalls.find(
        (call: any) => call[0]?.data?.status === "completed"
      );
      expect(completedUpdate).toBeDefined();
      expect(completedUpdate[0].data.error).toBe("Repo not enabled");
    });
  });

  describe("edge cases and error handling", () => {
    it("handles missing payload repository gracefully", async () => {
      const prisma = require("@/lib/prisma").default;
      const eventWithInvalidPayload = {
        ...validEvent,
        payload: { installation: { id: 123 } },
      };
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(eventWithInvalidPayload);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({
        ...eventWithInvalidPayload,
        status: "processing",
      });

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to process event");
    });

    it("handles missing installation id gracefully", async () => {
      const prisma = require("@/lib/prisma").default;
      const eventNoInstall = {
        ...validEvent,
        payload: {
          repository: { owner: { login: "owner" }, name: "repo" },
          pull_request: { number: 42 },
        },
      };
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(eventNoInstall);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({
        ...eventNoInstall,
        status: "processing",
      });

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to process event");
    });

    it("returns 500 with error details when processing fails", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockRejectedValueOnce(new Error("Repo lookup failed"));

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to process event");
      expect(body.details).toBeDefined();
    });

    it("sets the correct runtime and maxDuration exports", () => {
      const route = require("../route");
      expect(route.runtime).toBe("nodejs");
      expect(route.maxDuration).toBe(300);
    });
  });

  describe("regression: auth-before-rate-limit", () => {
    it("does not read x-worker-id header for any purpose", async () => {
      const spy = jest.fn();
      const req = mockRequest({
        authHeader: "Bearer valid-token",
        headers: { "x-worker-id": "evil-worker" },
      });

      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(true);
      asMock(checkRateLimit).mockResolvedValueOnce(rateLimitedResult({ allowed: true }));

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(req);

      expect(asMock(checkRateLimit)).toHaveBeenCalledWith("webhook-worker", expect.any(Object));
      expect(asMock(checkRateLimit)).not.toHaveBeenCalledWith("evil-worker", expect.any(Object));
      expect(asMock(checkRateLimit)).not.toHaveBeenCalledWith("unknown", expect.any(Object));
    });

    it("rejects unauthenticated requests before any processing", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const prisma = require("@/lib/prisma").default;
      const res = await POST(
        mockRequest({
          authHeader: "Bearer wrong-token",
          body: { eventId: "evt-001" },
        })
      );

      expect(res.status).toBe(401);
      expect(asMock(prisma.webhookEvent.findUnique)).not.toHaveBeenCalled();
      expect(asMock(prisma.webhookEvent.update)).not.toHaveBeenCalled();
      expect(asMock(checkRateLimit)).not.toHaveBeenCalled();
    });

    it("processes authenticated requests through full pipeline", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(true);
      asMock(checkRateLimit).mockResolvedValueOnce(rateLimitedResult({ allowed: true }));

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update)
        .mockResolvedValueOnce({ ...validEvent, status: "processing" })
        .mockResolvedValueOnce({ ...validEvent, status: "completed", error: "Repo not enabled" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      expect(res.status).toBe(200);
      expect(asMock(prisma.webhookEvent.findUnique)).toHaveBeenCalled();
      expect(asMock(prisma.webhookEvent.update)).toHaveBeenCalled();
    });

    it("auth failure early-exits without side effects", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const prisma = require("@/lib/prisma").default;
      await POST(mockRequest({ authHeader: "Bearer bad" }));

      expect(asMock(prisma.webhookEvent.findUnique)).not.toHaveBeenCalled();
      expect(asMock(webhookQueue.triggerWorkers)).not.toHaveBeenCalled();
      expect(asMock(checkRateLimit)).not.toHaveBeenCalled();
    });

    it("rate limit key does not contain any user-controlled input", async () => {
      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      await POST(
        mockRequest({
          authHeader: "Bearer valid-token",
          body: { eventId: "evt-001" },
          headers: {
            "x-worker-id": "malicious-id",
            "x-forwarded-for": "1.2.3.4",
          },
        })
      );

      const keyArg = asMock(checkRateLimit).mock.calls[0][0];
      expect(keyArg).toBe("webhook-worker");
      expect(keyArg).not.toContain("malicious-id");
      expect(keyArg).not.toContain("1.2.3.4");
      expect(keyArg).not.toContain("unknown");
    });

    it("auth check passes for valid bearer token", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(true);

      const prisma = require("@/lib/prisma").default;
      asMock(prisma.webhookEvent.findUnique).mockResolvedValueOnce(validEvent);
      asMock(prisma.webhookEvent.update).mockResolvedValueOnce({ ...validEvent, status: "processing" });
      asMock(prisma.gitHubRepo.findFirst).mockResolvedValueOnce(null);

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      expect(res.status).toBe(200);
    });

    it("isInternalWorkerAuthorized receives the raw auth header value", async () => {
      await POST(mockRequest({ authHeader: "Bearer abc123" }));

      expect(asMock(isInternalWorkerAuthorized)).toHaveBeenCalledWith("Bearer abc123");
    });

    it("returns 401 when authorization header is malformed", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest({ authHeader: "NotBearer something" }));

      expect(res.status).toBe(401);
    });

    it("returns 401 when authorization header is empty string", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);

      const res = await POST(mockRequest({ authHeader: "" }));

      expect(res.status).toBe(401);
    });
  });
});
