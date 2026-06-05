jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    analysisJob: {
      findUnique: jest.fn(),
    },
  },
}));

import { isAnalysisRunnerAuthorized, shouldThrottleJobKick } from "../analysisRunner";
import prisma from "@/lib/prisma";

const originalEnv = process.env;

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name] || null,
    },
  } as any;
}

describe("analysisRunner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ANALYSIS_RUNNER_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isAnalysisRunnerAuthorized", () => {
    it("returns false when ANALYSIS_RUNNER_SECRET is not set", () => {
      delete process.env.ANALYSIS_RUNNER_SECRET;
      const request = createMockRequest({ "x-analysis-runner-secret": "any-secret" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("returns false when ANALYSIS_RUNNER_SECRET is set to empty string", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "";
      const request = createMockRequest({ "x-analysis-runner-secret": "any-secret" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("returns true when valid secret is provided via header", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "valid-secret-123";
      const request = createMockRequest({ "x-analysis-runner-secret": "valid-secret-123" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(true);
    });

    it("returns false when invalid secret is provided via header", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "valid-secret-123";
      const request = createMockRequest({ "x-analysis-runner-secret": "wrong-secret" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("returns false when no secret header is provided", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "valid-secret-123";
      const request = createMockRequest({});
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("returns false when secret header is empty", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "valid-secret-123";
      const request = createMockRequest({ "x-analysis-runner-secret": "" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("rejects secrets with different lengths", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "short";
      const request = createMockRequest({ "x-analysis-runner-secret": "a-longer-secret-value" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("uses timing-safe comparison for valid secrets", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "exact-match-secret";
      const request = createMockRequest({ "x-analysis-runner-secret": "exact-match-secret" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(true);
    });

    it("does not accept secret via query string", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "query-secret-test";
      const request = {
        headers: {
          get: () => null,
        },
        url: "http://localhost/api/internal/run-analysis?secret=query-secret-test",
      } as any;
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("does not generate ephemeral secret when env var is not set", () => {
      delete process.env.ANALYSIS_RUNNER_SECRET;
      const request = createMockRequest({ "x-analysis-runner-secret": "any-secret" });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });

    it("rejects secret with trailing whitespace", () => {
      process.env.ANALYSIS_RUNNER_SECRET = "exact-secret";
      const request = createMockRequest({ "x-analysis-runner-secret": "exact-secret " });
      expect(isAnalysisRunnerAuthorized(request)).toBe(false);
    });
  });

  describe("shouldThrottleJobKick", () => {
    it("returns true when job is not found", async () => {
      (prisma.analysisJob.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await shouldThrottleJobKick("non-existent-id");
      expect(result).toBe(true);
    });

    it("returns true when job status is PROCESSING", async () => {
      (prisma.analysisJob.findUnique as jest.Mock).mockResolvedValue({
        id: "job-1",
        status: "PROCESSING",
        nextRunAt: null,
      });
      const result = await shouldThrottleJobKick("job-1");
      expect(result).toBe(true);
    });

    it("returns true when nextRunAt is in the future", async () => {
      const futureDate = new Date(Date.now() + 60000);
      (prisma.analysisJob.findUnique as jest.Mock).mockResolvedValue({
        id: "job-1",
        status: "QUEUED",
        nextRunAt: futureDate,
      });
      const result = await shouldThrottleJobKick("job-1");
      expect(result).toBe(true);
    });

    it("returns false when job is queued and nextRunAt is in the past", async () => {
      const pastDate = new Date(Date.now() - 60000);
      (prisma.analysisJob.findUnique as jest.Mock).mockResolvedValue({
        id: "job-1",
        status: "QUEUED",
        nextRunAt: pastDate,
      });
      const result = await shouldThrottleJobKick("job-1");
      expect(result).toBe(false);
    });

    it("returns false when job is queued and nextRunAt is not set", async () => {
      (prisma.analysisJob.findUnique as jest.Mock).mockResolvedValue({
        id: "job-1",
        status: "QUEUED",
        nextRunAt: null,
      });
      const result = await shouldThrottleJobKick("job-1");
      expect(result).toBe(false);
    });

    it("returns false (fail open) when database query throws", async () => {
      (prisma.analysisJob.findUnique as jest.Mock).mockRejectedValue(
        new Error("DB error")
      );
      const result = await shouldThrottleJobKick("job-1");
      expect(result).toBe(false);
    });
  });
});
