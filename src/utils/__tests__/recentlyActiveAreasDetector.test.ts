/**
 * Recently Active Areas Detector Tests
 * Unit tests for activity detection and analysis logic
 */

import {
  analyzeRecentActivity,
  calculateActivityMetrics,
} from "@/utils/recentlyActiveAreasDetector";
import {
  generateActivitySummary,
  formatTimeWindow,
  generateActivityInsights,
  suggestNextActions,
  estimateEngagementLevel,
} from "@/utils/recentlyActiveAreasHelpers";
import { RepositoryAnalysisData } from "@/types/contributionPath";

describe("Recently Active Areas Detector", () => {
  const mockRepository: RepositoryAnalysisData = {
    files: [
      { path: "src/components/Button.tsx", name: "Button.tsx", language: "typescript" },
      { path: "src/components/Card.tsx", name: "Card.tsx", language: "typescript" },
      { path: "src/services/authService.ts", name: "authService.ts", language: "typescript" },
      { path: "src/services/apiService.ts", name: "apiService.ts", language: "typescript" },
      { path: "app/api/route.ts", name: "route.ts", language: "typescript" },
      { path: "lib/auth.ts", name: "auth.ts", language: "typescript" },
      { path: "prisma/schema.prisma", name: "schema.prisma", language: "prisma" },
    ],
    commitHash: "abc123",
    analysisDate: new Date(),
    totalFiles: 7,
    insights: [],
  };

  describe("analyzeRecentActivity", () => {
    it("should generate activity analysis", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis).toBeDefined();
      expect(analysis.repositoryId).toBe("repo-1");
      expect(analysis.timeWindow).toBe("month");
      expect(analysis.windowDays).toBe(30);
    });

    it("should identify top active areas", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis.topActiveAreas).toBeDefined();
      expect(analysis.topActiveAreas.length).toBeGreaterThan(0);
      expect(analysis.topActiveAreas[0]).toHaveProperty("name");
      expect(analysis.topActiveAreas[0]).toHaveProperty("activityScore");
    });

    it("should calculate activity scores", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.activityScore).toBeGreaterThanOrEqual(0);
        expect(area.activityScore).toBeLessThanOrEqual(100);
      });
    });

    it("should handle different time windows", () => {
      const week = analyzeRecentActivity(mockRepository, "repo-1", "week");
      const month = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(week.windowDays).toBe(7);
      expect(month.windowDays).toBe(30);
    });

    it("should track commits in period", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.commitsInPeriod).toBeGreaterThanOrEqual(0);
      });
    });

    it("should track unique contributors", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.uniqueContributors).toBeGreaterThanOrEqual(0);
      });
    });

    it("should handle undefined repository", () => {
      const analysis = analyzeRecentActivity(undefined, "repo-1", "month");

      expect(analysis).toBeDefined();
      expect(analysis.repositoryId).toBe("repo-1");
    });
  });

  describe("calculateActivityMetrics", () => {
    it("should calculate valid metrics", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const metrics = calculateActivityMetrics(analysis);

      expect(metrics.totalActivity).toBeGreaterThanOrEqual(0);
      expect(metrics.averageCommitsPerDay).toBeGreaterThanOrEqual(0);
      expect(metrics.averageFilesPerCommit).toBeGreaterThanOrEqual(0);
      expect(metrics.healthIndicator).toMatch(
        /thriving|active|stable|declining/
      );
    });

    it("should count activity levels", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const metrics = calculateActivityMetrics(analysis);

      expect(metrics.coreAreasCount).toBeGreaterThanOrEqual(0);
      expect(metrics.emergingAreasCount).toBeGreaterThanOrEqual(0);
      expect(metrics.dormantAreasCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Activity Helpers", () => {
    it("should generate activity summary", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const summary = generateActivitySummary(analysis);

      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
    });

    it("should format time window", () => {
      const week = formatTimeWindow("week");
      const month = formatTimeWindow("month");

      expect(week).toBe("Last Week");
      expect(month).toBe("Last Month");
    });

    it("should generate insights", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const insights = generateActivityInsights(analysis);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });

    it("should suggest next actions", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const actions = suggestNextActions(analysis);

      expect(Array.isArray(actions)).toBe(true);
    });

    it("should estimate engagement level", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const level = estimateEngagementLevel(analysis);

      expect(level).toMatch(/high|medium|low/);
    });
  });

  describe("Activity Trends", () => {
    it("should generate activity trends", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis.activityTrends).toBeDefined();
      expect(Array.isArray(analysis.activityTrends)).toBe(true);
    });

    it("should detect change velocity", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.changeVelocity).toMatch(/accelerating|stable|declining/);
      });
    });
  });

  describe("Hotspots", () => {
    it("should identify hotspot areas", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis.hotspots).toBeDefined();
      expect(Array.isArray(analysis.hotspots)).toBe(true);
      if (analysis.hotspots.length > 0) {
        expect(analysis.hotspots[0]).toHaveProperty("path");
        expect(analysis.hotspots[0]).toHaveProperty("activityLevel");
        expect(analysis.hotspots[0]).toHaveProperty("commitCount");
      }
    });
  });

  describe("Recommendations", () => {
    it("should generate recommendations", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      analysis.recommendations.forEach((rec) => {
        expect(rec).toHaveProperty("title");
        expect(rec).toHaveProperty("description");
        expect(rec).toHaveProperty("priority");
      });
    });
  });

  describe("Area Properties", () => {
    it("should track files changed metrics", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.totalFilesChanged).toBeGreaterThanOrEqual(0);
        expect(area.filesModified).toBeGreaterThanOrEqual(0);
        expect(area.filesAdded).toBeGreaterThanOrEqual(0);
        expect(area.filesRemoved).toBeGreaterThanOrEqual(0);
      });
    });

    it("should track code change metrics", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.totalInsertions).toBeGreaterThanOrEqual(0);
        expect(area.totalDeletions).toBeGreaterThanOrEqual(0);
      });
    });

    it("should calculate commit frequency", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(typeof area.commitFrequency).toBe("number");
        expect(area.commitFrequency).toBeGreaterThanOrEqual(0);
      });
    });

    it("should calculate recency score", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.recencyScore).toBeGreaterThanOrEqual(0);
        expect(area.recencyScore).toBeLessThanOrEqual(100);
      });
    });

    it("should calculate impact score", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      analysis.topActiveAreas.forEach((area) => {
        expect(area.impactScore).toBeGreaterThanOrEqual(0);
        expect(area.impactScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Data Integrity", () => {
    it("should have valid analysis structure", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");

      expect(analysis).toHaveProperty("repositoryId");
      expect(analysis).toHaveProperty("analysisDate");
      expect(analysis).toHaveProperty("timeWindow");
      expect(analysis).toHaveProperty("totalCommits");
      expect(analysis).toHaveProperty("uniqueContributors");
      expect(analysis).toHaveProperty("affectedAreas");
      expect(analysis).toHaveProperty("topActiveAreas");
      expect(analysis).toHaveProperty("activityTrends");
      expect(analysis).toHaveProperty("hotspots");
      expect(analysis).toHaveProperty("recommendations");
    });

    it("should sort areas by activity score", () => {
      const analysis = analyzeRecentActivity(mockRepository, "repo-1", "month");
      const scores = analysis.topActiveAreas.map((a) => a.activityScore);

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });
});
