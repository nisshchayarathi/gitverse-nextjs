import {
  isAnalysisRunnerRateLimited,
  recordAnalysisRunnerAttempt,
} from "../rateLimitService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    loginAttempt: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const prisma = require("@/lib/prisma").default;

describe("Analysis Runner Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isAnalysisRunnerRateLimited", () => {
    it("returns false when count is below threshold", async () => {
      prisma.loginAttempt.count.mockResolvedValue(5);

      const result = await isAnalysisRunnerRateLimited("worker-1");
      expect(result).toBe(false);
    });

    it("returns true when count is at threshold", async () => {
      prisma.loginAttempt.count.mockResolvedValue(10);

      const result = await isAnalysisRunnerRateLimited("worker-1");
      expect(result).toBe(true);
    });

    it("returns true when count exceeds threshold", async () => {
      prisma.loginAttempt.count.mockResolvedValue(15);

      const result = await isAnalysisRunnerRateLimited("worker-1");
      expect(result).toBe(true);
    });

    it("queries with correct key prefix", async () => {
      prisma.loginAttempt.count.mockResolvedValue(0);

      await isAnalysisRunnerRateLimited("my-worker");

      expect(prisma.loginAttempt.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            key: "runner:my-worker",
            type: "ANALYSIS_RUNNER",
          }),
        })
      );
    });

    it("queries with correct time window", async () => {
      prisma.loginAttempt.count.mockResolvedValue(0);

      await isAnalysisRunnerRateLimited("worker-1");

      const where = prisma.loginAttempt.count.mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
      expect(where.createdAt.gte).toBeInstanceOf(Date);
    });

    it("throws on database errors (fail-closed)", async () => {
      prisma.loginAttempt.count.mockRejectedValue(new Error("DB error"));

      await expect(isAnalysisRunnerRateLimited("worker-1")).rejects.toThrow("DB error");
    });

    it("distinguishes between different workers", async () => {
      const calls: Record<string, number> = {
        "runner:worker-1": 10,
        "runner:worker-2": 3,
      };

      prisma.loginAttempt.count.mockImplementation(
        ({ where: { key } }: any) => Promise.resolve(calls[key] || 0)
      );

      expect(await isAnalysisRunnerRateLimited("worker-1")).toBe(true);
      expect(await isAnalysisRunnerRateLimited("worker-2")).toBe(false);
    });
  });

  describe("recordAnalysisRunnerAttempt", () => {
    it("records attempt with correct key format", async () => {
      prisma.loginAttempt.create.mockResolvedValue({ id: "1" });

      await recordAnalysisRunnerAttempt("worker-1", "job-123", true);

      expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
        data: {
          key: "runner:worker-1",
          type: "ANALYSIS_RUNNER",
          success: true,
          email: null,
          userId: null,
        },
      });
    });

    it("records failed attempts", async () => {
      prisma.loginAttempt.create.mockResolvedValue({ id: "1" });

      await recordAnalysisRunnerAttempt("worker-1", "job-123", false);

      expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
        }),
      });
    });

    it("throws on database errors (fail-closed)", async () => {
      prisma.loginAttempt.create.mockRejectedValue(new Error("DB error"));

      await expect(
        recordAnalysisRunnerAttempt("worker-1", "job-123", true)
      ).rejects.toThrow("DB error");
    });
  });
});
