import { WebhookQueueService } from "../webhook-queue";
import prisma from "../../prisma";
import { webhookQueueInstance } from "../../queue/webhookQueue";

jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((promises) => Promise.all(promises)),
    webhookEvent: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("../../queue/webhookQueue", () => ({
  webhookQueueInstance: {
    add: jest.fn(),
  },
  WEBHOOK_QUEUE_NAME: "webhook-events",
}));

describe("WebhookQueueService", () => {
  let queue: WebhookQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    queue = new WebhookQueueService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should batch and enqueue webhooks to BullMQ queue on flush", async () => {
    const mockCreatedEvents = [
      { id: "evt-1" },
      { id: "evt-2" },
    ];

    (prisma.webhookEvent.create as jest.Mock)
      .mockResolvedValueOnce(mockCreatedEvents[0])
      .mockResolvedValueOnce(mockCreatedEvents[1]);

    (webhookQueueInstance.add as jest.Mock).mockResolvedValue(undefined as any);

    queue.enqueueWebhook({ data: "foo" }, "push", undefined, "http://localhost");
    queue.enqueueWebhook({ data: "bar" }, "pull_request", "opened", "http://localhost");

    // Fast-forward timers
    jest.runAllTimers();

    // Flush all pending microtasks
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.webhookEvent.create).toHaveBeenCalledTimes(2);
    expect(prisma.webhookEvent.create).toHaveBeenNthCalledWith(1, {
      data: {
        event: "push",
        action: undefined,
        payload: { data: "foo" },
        status: "pending",
      },
      select: { id: true },
    });
    expect(prisma.webhookEvent.create).toHaveBeenNthCalledWith(2, {
      data: {
        event: "pull_request",
        action: "opened",
        payload: { data: "bar" },
        status: "pending",
      },
      select: { id: true },
    });

    expect(webhookQueueInstance.add).toHaveBeenCalledTimes(2);
    expect(webhookQueueInstance.add).toHaveBeenNthCalledWith(1, "process-webhook", { eventId: "evt-1" });
    expect(webhookQueueInstance.add).toHaveBeenNthCalledWith(2, "process-webhook", { eventId: "evt-2" });
  });

  it("should return correct status from triggerWorkers", async () => {
    (prisma.webhookEvent.count as jest.Mock)
      .mockResolvedValueOnce(3)  // processing/activeWorkers
      .mockResolvedValueOnce(7);  // pending/pendingJobs

    const status = await queue.triggerWorkers("http://localhost");

    expect(status).toEqual({
      activeWorkers: 3,
      pendingJobs: 7,
      isThrottled: false,
    });

    expect(prisma.webhookEvent.count).toHaveBeenCalledTimes(2);
    expect(prisma.webhookEvent.count).toHaveBeenNthCalledWith(1, {
      where: { status: "processing" },
    });
    expect(prisma.webhookEvent.count).toHaveBeenNthCalledWith(2, {
      where: { status: "pending" },
    });
  });
});
