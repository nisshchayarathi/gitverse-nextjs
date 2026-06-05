import { SafeHttpClient } from "@/services/security/safe-http-client";
import { WebhookQueueService } from "../webhook-queue";
import prisma from "../../prisma";

jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    webhookEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
    }
  }
}));

jest.mock("@/services/security/safe-http-client", () => ({
  SafeHttpClient: {
    fetch: jest.fn((url, init) => {
      (global as any).fetch(url, init);
      return Promise.resolve({} as any);
    }),
  },
}));

// Mock global fetch
jest.mock("@/services/security/safe-http-client", () => ({
  SafeHttpClient: {
    fetch: jest.fn(() => Promise.resolve({} as any)),
  },
}));

describe("WebhookQueueService", () => {
  const queue = new WebhookQueueService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throttle if active workers meet limit", async () => {
    (prisma.webhookEvent.count as jest.Mock)
      .mockResolvedValueOnce(5) // activeWorkers
      .mockResolvedValueOnce(10); // pendingJobs

    const status = await queue.triggerWorkers("http://localhost");

    expect(status.isThrottled).toBe(true);
    expect(status.activeWorkers).toBe(5);
    expect(status.pendingJobs).toBe(10);
    expect(prisma.webhookEvent.findMany).not.toHaveBeenCalled();
    expect(SafeHttpClient.fetch).not.toHaveBeenCalled();
  });

  it("should dispatch jobs up to available capacity", async () => {
    (prisma.webhookEvent.count as jest.Mock)
      .mockResolvedValueOnce(3) // activeWorkers (2 capacity left)
      .mockResolvedValueOnce(10); // pendingJobs

    (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "job-1" },
      { id: "job-2" }
    ]);

    process.env.INTERNAL_WORKER_SECRET = "test-secret";

    const status = await queue.triggerWorkers("http://localhost");

    expect(status.isThrottled).toBe(false);
    expect(status.activeWorkers).toBe(5); // 3 + 2
    expect(status.pendingJobs).toBe(8); // 10 - 2
    expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 2,
    });
    expect(SafeHttpClient.fetch).toHaveBeenCalledTimes(2);
  });
});
