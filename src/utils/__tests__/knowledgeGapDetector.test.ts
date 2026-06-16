import { detectKnowledgeGaps, getHealthScoreBadge } from "@/utils/knowledgeGapDetector";
import { RepositoryAnalysisData } from "@/types/contributionPath";

describe("Knowledge Gap Detector", () => {
  it("detects critical knowledge gaps in files with high imports and low documentation", () => {
    const mockRepository: RepositoryAnalysisData = {
      id: "test-repo",
      name: "test-repository",
      files: [
        {
          path: "src/auth/tokenManager.ts",
          size: 8000,
          type: "file",
          importance: 95,
          category: "Authentication",
        },
        {
          path: "src/utils/helpers.ts",
          size: 2000,
          type: "file",
          importance: 50,
          category: "Utilities",
        },
      ],
    };

    const report = detectKnowledgeGaps(mockRepository);

    expect(report).toBeDefined();
    expect(report.totalFilesAnalyzed).toBeGreaterThan(0);
    expect(report.repositoryHealthScore).toBeGreaterThanOrEqual(0);
    expect(report.repositoryHealthScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.criticalGaps)).toBe(true);
    expect(Array.isArray(report.highRiskGaps)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it("generates health score badge correctly", () => {
    expect(getHealthScoreBadge(85)).toBe("Excellent");
    expect(getHealthScoreBadge(70)).toBe("Good");
    expect(getHealthScoreBadge(50)).toBe("Fair");
    expect(getHealthScoreBadge(30)).toBe("Needs Improvement");
  });

  it("includes actionable recommendations", () => {
    const mockRepository: RepositoryAnalysisData = {
      id: "test-repo",
      name: "test-repository",
      files: [
        {
          path: "src/middleware/auth.ts",
          size: 5000,
          type: "file",
          importance: 90,
        },
      ],
    };

    const report = detectKnowledgeGaps(mockRepository);

    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toHaveProperty("title");
    expect(report.recommendations[0]).toHaveProperty("description");
    expect(report.recommendations[0]).toHaveProperty("priority");
    expect(report.recommendations[0]).toHaveProperty("estimatedEffort");
  });

  it("provides insights for repository documentation health", () => {
    const mockRepository: RepositoryAnalysisData = {
      id: "test-repo",
      name: "test-repository",
      files: [
        {
          path: "src/auth.ts",
          size: 8000,
          type: "file",
        },
      ],
    };

    const report = detectKnowledgeGaps(mockRepository);

    expect(Array.isArray(report.insights)).toBe(true);
  });
});
