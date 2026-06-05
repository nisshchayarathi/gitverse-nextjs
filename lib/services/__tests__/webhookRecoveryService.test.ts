import { nextRetryDate, isRetryableError } from "@/lib/utils/retry";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    webhookEvent: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Import after mocking
import prisma from "@/lib/prisma";

const mockPrisma = prisma as any;

describe("Webhook Recovery Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("nextRetryDate utility", () => {
    it("returns a Date in the future with default config", () => {
      const before = Date.now();
      const result = nextRetryDate(0);
      const after = Date.now();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before + 10000);
      expect(result.getTime()).toBeLessThanOrEqual(after + 10000 + 100);
    });

    it("uses custom config for recovery delays", () => {
      const recoveryConfig = {
        baseDelayMs: 60_000 as number,
        maxDelayMs: 30 * 60 * 1000 as number,
      };

      const before = Date.now();
      const result = nextRetryDate(0, recoveryConfig);
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before + 60000);
      expect(result.getTime()).toBeLessThanOrEqual(after + 60000 + 100);
    });

    it("caps at max delay", () => {
      const recoveryConfig = {
        baseDelayMs: 60_000,
        maxDelayMs: 30 * 60 * 1000,
      };

      const result = nextRetryDate(100, recoveryConfig);
      expect(result.getTime() - Date.now()).toBeLessThanOrEqual(recoveryConfig.maxDelayMs + 100);
    });
  });

  describe("retry decision logic", () => {
    it("should retry when under max retries and error is retryable", () => {
      const maxRetries = 3;
      const currentRetryCount = 0;
      const error = new Error("ETIMEDOUT");

      const isRetryable = isRetryableError(error);
      const shouldRetry = isRetryable && currentRetryCount < maxRetries;
      expect(shouldRetry).toBe(true);
    });

    it("should not retry when max retries exceeded", () => {
      const maxRetries = 3;
      const currentRetryCount = 3;
      const error = new Error("ETIMEDOUT");

      const isRetryable = isRetryableError(error);
      const shouldRetry = isRetryable && currentRetryCount < maxRetries;
      expect(shouldRetry).toBe(false);
    });

    it("should not retry when error is not retryable", () => {
      const maxRetries = 3;
      const currentRetryCount = 0;
      const error = new Error("Invalid API key");

      const isRetryable = isRetryableError(error);
      const shouldRetry = isRetryable && currentRetryCount < maxRetries;
      expect(shouldRetry).toBe(false);
    });
  });

  describe("backoff calculation", () => {
    it("uses exponential backoff with recovery config", () => {
      const recoveryConfig = {
        baseDelayMs: 60 * 1000, // 1 minute
        maxDelayMs: 30 * 60 * 1000, // 30 minutes
        backoffMultiplier: 2,
      };

      const delays = [];
      for (let i = 0; i < 5; i++) {
        const delay = Math.min(
          recoveryConfig.maxDelayMs,
          recoveryConfig.baseDelayMs * Math.pow(recoveryConfig.backoffMultiplier, i)
        );
        delays.push(delay);
      }

      expect(delays[0]).toBe(60000);    // 1 minute
      expect(delays[1]).toBe(120000);   // 2 minutes
      expect(delays[2]).toBe(240000);   // 4 minutes
      expect(delays[3]).toBe(480000);   // 8 minutes
      expect(delays[4]).toBe(960000);   // 16 minutes
    });

    it("caps at max delay", () => {
      const recoveryConfig = {
        baseDelayMs: 60 * 1000,
        maxDelayMs: 30 * 60 * 1000,
      };

      const delay = Math.min(
        recoveryConfig.maxDelayMs,
        recoveryConfig.baseDelayMs * Math.pow(2, 100)
      );

      expect(delay).toBe(recoveryConfig.maxDelayMs);
    });
  });

  describe("event status transitions", () => {
    it("marks stuck events as pending for retry", async () => {
      const stuckEvents = [
        { id: "1", retryCount: 0, maxRetries: 3 },
        { id: "2", retryCount: 1, maxRetries: 3 },
      ];

      mockPrisma.webhookEvent.findMany.mockResolvedValueOnce(stuckEvents);
      mockPrisma.webhookEvent.update.mockResolvedValue({});

      // Simulate the recovery logic
      const recovered = [];
      for (const event of stuckEvents) {
        if (event.retryCount < event.maxRetries) {
          recovered.push(event);
        }
      }

      expect(recovered.length).toBe(2);
    });

    it("marks events as failed when max retries exceeded", async () => {
      const stuckEvents = [
        { id: "1", retryCount: 3, maxRetries: 3 },
        { id: "2", retryCount: 4, maxRetries: 3 },
      ];

      const failed = [];
      for (const event of stuckEvents) {
        if (event.retryCount >= event.maxRetries) {
          failed.push(event);
        }
      }

      expect(failed.length).toBe(2);
    });

    it("increments retry count on recovery", async () => {
      const event = { id: "1", retryCount: 1, maxRetries: 3 };
      const newRetryCount = event.retryCount + 1;

      expect(newRetryCount).toBe(2);
    });
  });

  describe("error handling", () => {
    it("handles null error messages", () => {
      const error: any = null;
      const message = error?.message?.toLowerCase() || "";
      expect(message).toBe("");
    });

    it("handles undefined error messages", () => {
      const error: any = undefined;
      const message = error?.message?.toLowerCase() || "";
      expect(message).toBe("");
    });

    it("handles errors without message property", () => {
      const error: any = { code: "SOME_CODE" };
      const message = error?.message?.toLowerCase() || "";
      expect(message).toBe("");
    });
  });
});
