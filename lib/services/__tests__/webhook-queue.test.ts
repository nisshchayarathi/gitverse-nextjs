import { WebhookQueueService } from "../webhook-queue";
import prisma from "../../prisma";
import { webhookQueueInstance } from "../../queue/webhookQueue";

jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    webhookEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("../../queue/webhookQueue", () => ({
  __esModule: true,
  webhookQueueInstance: {
    addBulk: jest.fn(),
  },
}));

describe("WebhookQueueService", () => {
  const queue = new WebhookQueueService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("enqueueWebhook", () => {
    it("should create a webhook event and enqueue it via BullMQ", async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: "evt-001" });

      await queue.enqueueWebhook({ foo: "bar" }, "push", undefined, "http://localhost");

      expect(prisma.webhookEvent.findFirst).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          event: "push",
          action: undefined,
          payload: { foo: "bar" },
          status: "pending",
          deliveryId: undefined,
        },
        select: { id: true },
      });
      expect(webhookQueueInstance.addBulk).toHaveBeenCalledWith([
        { name: "process-webhook", data: { eventId: "evt-001" } },
      ]);
    });

    it("should create a webhook event with action and deliveryId when provided", async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: "evt-002" });

      await queue.enqueueWebhook(
        { pull_request: { number: 42 } },
        "pull_request",
        "opened",
        "http://example.com",
        "delivery-abc-123"
      );

      expect(prisma.webhookEvent.findFirst).toHaveBeenCalledWith({
        where: { deliveryId: "delivery-abc-123" },
      });
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: "pull_request",
            action: "opened",
            deliveryId: "delivery-abc-123",
          }),
        })
      );
      expect(webhookQueueInstance.addBulk).toHaveBeenCalledWith([
        { name: "process-webhook", data: { eventId: "evt-002" } },
      ]);
    });

    it("should deduplicate by deliveryId when it already exists", async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue({ id: "evt-001" });

      await queue.enqueueWebhook({ foo: "bar" }, "push", undefined, "http://localhost", "delivery-123");

      expect(prisma.webhookEvent.findFirst).toHaveBeenCalledWith({
        where: { deliveryId: "delivery-123" },
      });
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(webhookQueueInstance.addBulk).not.toHaveBeenCalled();
    });

    it("should create event even without deliveryId (no dedup check)", async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: "evt-003" });

      await queue.enqueueWebhook({ x: 1 }, "issues", "opened", "http://localhost");

      expect(prisma.webhookEvent.findFirst).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).toHaveBeenCalled();
      expect(webhookQueueInstance.addBulk).toHaveBeenCalled();
    });

    it("should default event name to 'unknown' when event is undefined", async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: "evt-004" });

      await queue.enqueueWebhook({}, undefined as any, undefined, "http://localhost");

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: "unknown",
          }),
        })
      );
    });

    it("should propagate DB create errors", async () => {
      (prisma.webhookEvent.create as jest.Mock).mockRejectedValue(new Error("DB connection failed"));

      await expect(
        queue.enqueueWebhook({}, "push", undefined, "http://localhost")
      ).rejects.toThrow("DB connection failed");

      expect(webhookQueueInstance.addBulk).not.toHaveBeenCalled();
    });

    it("should propagate addBulk errors after a successful DB create", async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue({ id: "evt-005" });
      (webhookQueueInstance.addBulk as jest.Mock).mockRejectedValue(new Error("Redis unreachable"));

      await expect(
        queue.enqueueWebhook({}, "push", undefined, "http://localhost")
      ).rejects.toThrow("Redis unreachable");

      expect(prisma.webhookEvent.create).toHaveBeenCalled();
    });

    it("should handle concurrent dedup checks without interfering", async () => {
      (prisma.webhookEvent.findFirst as jest.Mock)
        .mockResolvedValue(null);
      (prisma.webhookEvent.create as jest.Mock)
        .mockResolvedValue({ id: "evt-006" });
      (webhookQueueInstance.addBulk as jest.Mock).mockResolvedValue(undefined);

      await Promise.all([
        queue.enqueueWebhook({ a: 1 }, "push", undefined, "http://localhost", "delivery-concurrent"),
        queue.enqueueWebhook({ b: 2 }, "pull_request", "synchronize", "http://localhost", "delivery-concurrent"),
      ]);

      expect(prisma.webhookEvent.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("triggerWorkers", () => {
    it("should return active worker and pending job counts", async () => {
      (prisma.webhookEvent.count as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      const status = await queue.triggerWorkers("http://localhost");

      expect(status.isThrottled).toBe(false);
      expect(status.activeWorkers).toBe(5);
      expect(status.pendingJobs).toBe(10);
    });

    it("should return zero counts when no events exist", async () => {
      (prisma.webhookEvent.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const status = await queue.triggerWorkers("http://localhost");

      expect(status.activeWorkers).toBe(0);
      expect(status.pendingJobs).toBe(0);
    });

    it("should not use findMany for anything", async () => {
      (prisma.webhookEvent.count as jest.Mock)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(10);

      await queue.triggerWorkers("http://localhost");

      expect(prisma.webhookEvent.findMany).not.toHaveBeenCalled();
    });
  });
});
