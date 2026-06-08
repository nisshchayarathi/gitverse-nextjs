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

jest.mock("@/lib/queue/webhookQueue", () => {
  const mockAdd = jest.fn().mockResolvedValue(undefined);
  return {
    webhookQueue: {
      add: mockAdd,
    },
    WEBHOOK_QUEUE_NAME: "webhook-events",
  };
});

import { POST } from "../route";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";
import { checkRateLimit } from "@/lib/middleware/rateLimit";
import { webhookQueue } from "@/lib/queue/webhookQueue";
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

describe("POST /api/internal/worker/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_WORKER_SECRET = "test-secret";
    asMock(checkRateLimit).mockResolvedValue(rateLimitedResult({ allowed: true }));
  });

  afterEach(() => {
    delete process.env.INTERNAL_WORKER_SECRET;
  });

  describe("authentication", () => {
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

    it("does not enqueue on auth failure", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);
      await POST(mockRequest());
      expect(asMock(webhookQueue.add)).not.toHaveBeenCalled();
    });

    it("isInternalWorkerAuthorized is called with the authorization header", async () => {
      asMock(isInternalWorkerAuthorized).mockReturnValueOnce(false);
      await POST(mockRequest({ authHeader: "Bearer some-token" }));
      expect(asMock(isInternalWorkerAuthorized)).toHaveBeenCalledWith("Bearer some-token");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit exceeded", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: false, remaining: 0 })
      );
      const res = await POST(mockRequest({ authHeader: "Bearer valid-token" }));
      expect(res.status).toBe(429);
    });

    it("does not enqueue when rate limited", async () => {
      asMock(checkRateLimit).mockResolvedValueOnce(
        rateLimitedResult({ allowed: false, remaining: 0 })
      );
      await POST(mockRequest({ authHeader: "Bearer valid-token" }));
      expect(asMock(webhookQueue.add)).not.toHaveBeenCalled();
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
  });

  describe("eventId validation", () => {
    it("returns 400 when eventId is missing", async () => {
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

    it("returns 400 when body is malformed JSON", async () => {
      const req = mockRequest({ authHeader: "Bearer valid-token" });
      asMock(req.json).mockRejectedValueOnce(new Error("Unexpected token"));
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("eventId is required");
    });
  });

  describe("successful enqueue", () => {
    it("returns 202 and enqueues to BullMQ when eventId is provided", async () => {
      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(202);
      expect(body.ok).toBe(true);
      expect(body.message).toBe("Webhook event enqueued for distributed processing");
      expect(asMock(webhookQueue.add)).toHaveBeenCalledWith(
        "webhook_event",
        { eventId: "evt-001" },
        expect.objectContaining({ attempts: 5 })
      );
    });

    it("enqueues to BullMQ with exponential backoff", async () => {
      await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );

      expect(asMock(webhookQueue.add)).toHaveBeenCalledWith(
        "webhook_event",
        { eventId: "evt-001" },
        expect.objectContaining({
          backoff: { type: "exponential", delay: 5000 },
        })
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when BullMQ add fails", async () => {
      asMock(webhookQueue.add).mockRejectedValueOnce(new Error("Redis connection failed"));

      const res = await POST(
        mockRequest({ authHeader: "Bearer valid-token", body: { eventId: "evt-001" } })
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Failed to enqueue webhook event");
    });

    it("sets the correct runtime and maxDuration exports", () => {
      const route = require("../route");
      expect(route.runtime).toBe("nodejs");
      expect(route.maxDuration).toBe(30);
    });
  });
});
