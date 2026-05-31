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

// Mock global fetch
global.fetch = jest.fn(() => Promise.resolve({} as any));

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
    expect(global.fetch).not.toHaveBeenCalled();
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
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
