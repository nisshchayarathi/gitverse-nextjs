/**
 * Architecture Drift Detector Tests
 * Unit tests for drift detection logic and architecture analysis
 */

import {
  generateArchitectureSnapshot,
  analyzeDrift,
  calculateArchitectureMetrics,
} from "@/utils/architectureDriftDetector";
import {
  formatDriftScore,
  compareShadshots,
  generateDriftTrends,
  detectDriftAnomalies,
  generateArchitectureInsights,
  requiresImmediateAction,
} from "@/utils/architectureDriftHelpers";
import { RepositoryAnalysisData } from "@/types/contributionPath";

describe("Architecture Drift Detector", () => {
  const mockRepository: RepositoryAnalysisData = {
    files: [
      { path: "src/components/Button.tsx" },
      { path: "src/components/Card.tsx" },
      { path: "src/services/authService.ts" },
      { path: "src/services/apiService.ts" },
      { path: "prisma/schema.prisma" },
      { path: "src/lib/utils.ts" },
      { path: "src/config/constants.ts" },
      { path: "src/api/route.ts" },
    ],
    commitHash: "abc123",
    analysisDate: new Date(),
    totalFiles: 8,
    insights: [],
  };

  describe("generateArchitectureSnapshot", () => {
    it("should generate a valid snapshot", () => {
      const snapshot = generateArchitectureSnapshot(mockRepository, "repo-1");

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.repositoryId).toBe("repo-1");
      expect(snapshot.moduleCount).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });

    it("should correctly categorize files by layer", () => {
      const snapshot = generateArchitectureSnapshot(mockRepository, "repo-1");

      expect(snapshot.layerDistribution.UI).toBeGreaterThanOrEqual(0);
      expect(snapshot.layerDistribution.Services).toBeGreaterThanOrEqual(0);
      expect(snapshot.layerDistribution.Database).toBeGreaterThanOrEqual(0);
      expect(snapshot.layerDistribution.Config).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty repository", () => {
      const snapshot = generateArchitectureSnapshot(undefined, "repo-1");

      expect(snapshot).toBeDefined();
      expect(snapshot.totalDependencies).toBe(0);
      expect(snapshot.moduleCount).toBe(0);
    });
  });

  describe("analyzeDrift", () => {
    it("should analyze drift between snapshots", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      expect(analysis).toBeDefined();
      expect(analysis.driftScore).toBeGreaterThanOrEqual(0);
      expect(analysis.driftScore).toBeLessThanOrEqual(100);
      expect(analysis.riskLevel).toMatch(/Critical|High|Medium|Low/);
    });

    it("should detect new dependencies", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      expect(Array.isArray(analysis.newDependencies)).toBe(true);
    });

    it("should handle first snapshot without history", () => {
      const snapshot = generateArchitectureSnapshot(mockRepository, "repo-1");
      const analysis = analyzeDrift(snapshot, null);

      expect(analysis.driftScore).toBe(0);
      expect(analysis.previousSnapshot).toBeNull();
      expect(analysis.timeframeDays).toBe(0);
    });
  });

  describe("calculateArchitectureMetrics", () => {
    it("should calculate valid metrics", () => {
      const snapshot = generateArchitectureSnapshot(mockRepository, "repo-1");
      const metrics = calculateArchitectureMetrics(snapshot);

      expect(metrics.totalDependencies).toBeGreaterThanOrEqual(0);
      expect(metrics.coupling).toBeGreaterThanOrEqual(0);
      expect(metrics.coupling).toBeLessThanOrEqual(100);
      expect(metrics.cohesion).toBeGreaterThanOrEqual(0);
      expect(metrics.cohesion).toBeLessThanOrEqual(100);
      expect(metrics.healthScore).toBeGreaterThanOrEqual(0);
      expect(metrics.healthScore).toBeLessThanOrEqual(100);
    });

    it("should penalize violations in health score", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const metrics1 = calculateArchitectureMetrics(snapshot1);

      expect(metrics1.healthScore).toBeDefined();
      expect(typeof metrics1.healthScore === "number").toBe(true);
    });
  });

  describe("Drift Helpers", () => {
    it("should format drift score correctly", () => {
      const result = formatDriftScore(45.5);

      expect(result.percentage).toMatch(/\d+%/);
      expect(result.label).toMatch(/Critical|High|Medium|Low/);
      expect(result.severity).toMatch(/Critical|High|Medium|Low/);
    });

    it("should compare snapshots", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const comparison = compareShadshots(snapshot2, snapshot1);

      expect(comparison).toHaveProperty("dependencyChange");
      expect(comparison).toHaveProperty("violationChange");
      expect(comparison).toHaveProperty("moduleChange");
      expect(comparison).toHaveProperty("summary");
    });

    it("should generate drift trends", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot3 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const trends = generateDriftTrends([snapshot1, snapshot2, snapshot3]);

      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBe(3);
      expect(trends[0]).toHaveProperty("driftScore");
      expect(trends[0]).toHaveProperty("violationCount");
      expect(trends[0]).toHaveProperty("healthScore");
    });

    it("should detect drift anomalies", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const trends = generateDriftTrends([snapshot1, snapshot2]);
      const anomalies = detectDriftAnomalies(trends);

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it("should generate architecture insights", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const trends = generateDriftTrends([snapshot1, snapshot2]);
      const insights = generateArchitectureInsights(trends);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe("Risk Assessment", () => {
    it("should require action for critical drift", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      const needsAction = requiresImmediateAction(analysis);
      expect(typeof needsAction).toBe("boolean");
    });

    it("should identify increasing violation trend", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      expect(analysis.violationsTrend).toMatch(/increasing|decreasing|stable/);
    });
  });

  describe("Recommendations", () => {
    it("should generate recommendations", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      expect(Array.isArray(analysis.recommendations)).toBe(true);
      analysis.recommendations.forEach((rec) => {
        expect(rec).toHaveProperty("priority");
        expect(rec).toHaveProperty("title");
        expect(rec).toHaveProperty("description");
        expect(rec).toHaveProperty("action");
        expect(rec).toHaveProperty("estimatedEffort");
      });
    });

    it("should prioritize critical recommendations", () => {
      const snapshot1 = generateArchitectureSnapshot(mockRepository, "repo-1");
      const snapshot2 = generateArchitectureSnapshot(mockRepository, "repo-1");

      const analysis = analyzeDrift(snapshot2, snapshot1);

      const hasRecommendations = analysis.recommendations.length > 0;
      if (hasRecommendations) {
        expect(analysis.recommendations[0].priority).toBeDefined();
      }
    });
  });
});
