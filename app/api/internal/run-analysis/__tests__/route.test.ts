import { NextRequest } from "next/server";

jest.mock("@/lib/utils/analysisRunner", () => ({
  isAnalysisRunnerAuthorized: jest.fn(),
  registerUnhandledRejectionLogger: jest.fn(),
}));

jest.mock("@/lib/services/analysisJobService", () => ({
  analysisJobService: {
    claimNextJob: jest.fn(),
    updateProgress: jest.fn(),
    markDone: jest.fn(),
    markFailed: jest.fn(),
  },
}));

jest.mock("@/lib/services/repositoryService", () => ({
  repositoryService: {
    analyzeRepository: jest.fn(),
  },
}));

jest.mock("@/lib/services/rateLimitService", () => ({
  isRateLimited: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { POST } from "../route";
import { isAnalysisRunnerAuthorized } from "@/lib/utils/analysisRunner";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";
import { isRateLimited } from "@/lib/services/rateLimitService";

describe("POST /api/internal/run-analysis", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ANALYSIS_RUNNER_SECRET = "test-runner-secret";
    delete process.env.VERCEL_REGION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 500 when ANALYSIS_RUNNER_SECRET is not configured", async () => {
    delete process.env.ANALYSIS_RUNNER_SECRET;

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      { method: "POST" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe("SECRET_MISSING");
  });

  it("returns 401 when not authorized", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(false);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      { method: "POST" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(true);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("returns 204 when no jobs available", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(204);
  });

  it("processes a job successfully", async () => {
    const mockJob = {
      id: "job-123",
      repositoryId: 1,
      userId: 1,
      progressPercent: 0,
      progressMessage: "Queued",
      attempts: 1,
      maxAttempts: 3,
      status: "QUEUED",
    };

    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(mockJob);
    (analysisJobService.updateProgress as jest.Mock).mockResolvedValue(undefined);
    (repositoryService.analyzeRepository as jest.Mock).mockResolvedValue(undefined);
    (analysisJobService.markDone as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.jobId).toBe("job-123");
    expect(data.status).toBe("DONE");
  });

  it("handles job processing failure with retry", async () => {
    const mockJob = {
      id: "job-456",
      repositoryId: 1,
      userId: 1,
      progressPercent: 0,
      progressMessage: "Queued",
      attempts: 1,
      maxAttempts: 3,
      status: "QUEUED",
    };

    const processingError = new Error("Analysis failed unexpectedly");

    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(mockJob);
    (analysisJobService.updateProgress as jest.Mock).mockResolvedValue(undefined);
    (repositoryService.analyzeRepository as jest.Mock).mockRejectedValue(processingError);
    (analysisJobService.markFailed as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.jobId).toBe("job-456");
    expect(data.status).toBe("FAILED");
  });

  it("sanitizes error messages in production", async () => {
    process.env.NODE_ENV = "production";

    const mockJob = {
      id: "job-789",
      repositoryId: 1,
      userId: 1,
      progressPercent: 0,
      progressMessage: "Queued",
      attempts: 1,
      maxAttempts: 3,
      status: "QUEUED",
    };

    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(mockJob);
    (analysisJobService.updateProgress as jest.Mock).mockResolvedValue(undefined);
    (repositoryService.analyzeRepository as jest.Mock).mockRejectedValue(
      new Error("Internal: database connection failed at host=secret-db.internal")
    );
    (analysisJobService.markFailed as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Analysis failed");
    expect(data.error).not.toContain("secret-db");
  });

  it("includes workerId with VERCEL_REGION when available", async () => {
    process.env.VERCEL_REGION = "iad1";

    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockImplementation(
      async ({ workerId }: { workerId: string }) => {
        expect(workerId).toContain("serverless:iad1:");
        return null;
      }
    );

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );
    await POST(request);

    expect(analysisJobService.claimNextJob).toHaveBeenCalled();
  });

  it("handles claimNextJob database error gracefully", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockRejectedValue(
      new Error("Database connection failed")
    );

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: { "x-analysis-runner-secret": "test-runner-secret" },
      }
    );

    await expect(POST(request)).rejects.toThrow("Database connection failed");
  });

  it("uses x-forwarded-for for client IP detection", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: {
          "x-analysis-runner-secret": "test-runner-secret",
          "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(isRateLimited).toHaveBeenCalledWith(
      "203.0.113.42",
      "LOGIN",
      5,
      300000
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is not available", async () => {
    (isAnalysisRunnerAuthorized as jest.Mock).mockReturnValue(true);
    (isRateLimited as jest.Mock).mockResolvedValue(false);
    (analysisJobService.claimNextJob as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/internal/run-analysis",
      {
        method: "POST",
        headers: {
          "x-analysis-runner-secret": "test-runner-secret",
          "x-real-ip": "198.51.100.7",
        },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(isRateLimited).toHaveBeenCalledWith(
      "198.51.100.7",
      "LOGIN",
      5,
      300000
    );
  });
});
