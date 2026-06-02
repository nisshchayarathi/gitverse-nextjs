import { getIncidentIngestionService } from "../incident-ingestion";
import { getIncidentCorrelationService } from "../incident-correlation";
import { getRollbackPrService } from "../rollback-pr";
import { getDeploymentAnalysisService } from "../deployment-analysis";

// Mock external dependencies
const mockChatRaw = jest.fn();
jest.mock("../geminiService", () => ({
  getGeminiService: () => ({
    chatRaw: mockChatRaw,
  }),
}));

jest.mock("../githubService", () => ({
  githubService: {
    client: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    },
    getRepository: jest.fn(),
  },
}));

jest.mock("../revert-generator", () => ({
  getRevertGeneratorService: () => ({
    createRevertBranch: jest.fn().mockResolvedValue("rollback/incident-mock"),
  }),
}));

describe("Incident Response Pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MIN_ROLLBACK_CONFIDENCE = "85";
    process.env.AUTO_ROLLBACK_ENABLED = "false";
  });

  describe("Scenario 1: Single PR causes incident", () => {
    it("should process webhook, correlate correctly, and prepare rollback", async () => {
      const ingestion = getIncidentIngestionService();
      const incident = ingestion.processWebhook("generic", {
        title: "Test Error",
        severity: "critical",
      });

      expect(incident.severity).toBe("critical");

      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          likelyPrNumber: 421,
          likelyCommitSha: "abc1234",
          impactedFiles: ["src/main.ts"],
          impactedServices: ["api"],
          confidenceScore: 91,
          analysisDetails: "Found null reference exception.",
        }),
      });

      const correlationSvc = getIncidentCorrelationService();
      const correlation = await correlationSvc.correlateIncident(incident, "PR #421 context");

      expect(correlation.likelyPrNumber).toBe(421);
      expect(correlation.confidenceScore).toBe(91);

       const rollbackSvc = getRollbackPrService();
       const { githubService } = require("../githubService");
       
       githubService.getRepository.mockResolvedValueOnce({ default_branch: "main" });
       githubService.client.post.mockResolvedValueOnce({ data: { html_url: "http://github.com/pr/1", number: 1 } });
       githubService.client.put.mockResolvedValueOnce({});

      const result = await rollbackSvc.executeRollback(1, "owner", "repo", incident as any, correlation);
      
      expect(result.success).toBe(true);
      expect(result.autoMerged).toBe(false);
      expect(githubService.client.post).toHaveBeenCalled();
    });
  });

  describe("Scenario 2: Multiple candidate PRs (ambiguous)", () => {
    it("should lower confidence if multiple PRs are possible", async () => {
      // Simulation where Gemini returns low confidence
      const { getGeminiService } = require("../geminiService");
      getGeminiService().chatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          likelyPrNumber: 421,
          confidenceScore: 50,
          analysisDetails: "Could be PR 421 or 422.",
        }),
      });

      const correlationSvc = getIncidentCorrelationService();
      const correlation = await correlationSvc.correlateIncident(
        getIncidentIngestionService().processWebhook("generic", { title: "Error" }),
        "context"
      );

      expect(correlation.confidenceScore).toBe(50);

      const rollbackSvc = getRollbackPrService();
      const result = await rollbackSvc.executeRollback(1, "o", "r", { id: "1" } as any, correlation);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Confidence score (50) is below threshold");
    });
  });

  describe("Scenario 3: Low-confidence correlation", () => {
    it("should prevent rollback generation if confidence is below threshold", async () => {
      const rollbackSvc = getRollbackPrService();
      const correlation = {
        likelyPrNumber: 123,
        confidenceScore: 80,
        impactedFiles: [], impactedServices: [], analysisDetails: ""
      };
      const result = await rollbackSvc.executeRollback(1, "o", "r", { id: "1" } as any, correlation);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("below threshold");
    });
  });

  describe("Scenario 4: Rollback PR generation", () => {
    it("should generate a PR with a well-formatted body", async () => {
      const rollbackSvc = getRollbackPrService();
      const { githubService } = require("../githubService");
      githubService.getRepository.mockResolvedValueOnce({ default_branch: "main" });
      githubService.client.post.mockResolvedValueOnce({ data: { html_url: "url" } });

      const result = await rollbackSvc.executeRollback(1, "o", "r", { id: "1", source: "generic", severity: "high", title: "Err" } as any, {
        likelyPrNumber: 999, confidenceScore: 99, impactedFiles: [], impactedServices: [], analysisDetails: ""
      });

      expect(result.success).toBe(true);
      expect(githubService.client.post).toHaveBeenCalledWith(
        `/repos/o/r/pulls`,
        expect.objectContaining({ title: expect.stringContaining("Revert PR #999") })
      );
    });
  });

  describe("Scenario 5: Auto-merge enabled", () => {
    it("should auto-merge the PR if setting is enabled", async () => {
      process.env.AUTO_ROLLBACK_ENABLED = "true";
      
      const { githubService } = require("../githubService");
      githubService.getRepository.mockResolvedValueOnce({ default_branch: "main" });
      githubService.client.post.mockResolvedValueOnce({ data: { html_url: "http://github.com/pr/1", number: 10 } });
      githubService.client.put.mockResolvedValueOnce({});

      const rollbackSvc = getRollbackPrService();
      const result = await rollbackSvc.executeRollback(1, "o", "r", { id: "1", severity: "critical", title: "err" } as any, {
        likelyPrNumber: 100, confidenceScore: 95, impactedFiles: [], impactedServices: [], analysisDetails: ""
      });

      expect(result.success).toBe(true);
      expect(result.autoMerged).toBe(true);
      expect(githubService.client.put).toHaveBeenCalledWith(
        `/repos/o/r/pulls/10/merge`,
        expect.objectContaining({ merge_method: "squash" })
      );
    });
  });
});
