import {
  calculateComplexityScore,
  calculateModularityScore,
  calculateCohesionScore,
  calculateCouplingScore,
  calculateRepositoryHealth,
  compareHealthMetrics,
  getHealthStatus,
  getHealthColor,
} from "@/utils/complexityCalculator";
import { ArchitectureSnapshot } from "@/types/architectureDrift";

const EMPTY_LAYER_DISTRIBUTION = {
  UI: 0,
  Services: 0,
  Database: 0,
  Auth: 0,
  API: 0,
  Utils: 0,
  Config: 0,
  Other: 0,
};

function buildSnapshot(
  overrides: Partial<ArchitectureSnapshot> = {}
): ArchitectureSnapshot {
  return {
    timestamp: new Date("2026-01-01"),
    snapshotDate: "2026-01-01",
    label: "test",
    modules: [],
    metrics: {
      moduleCount: 0,
      totalDependencies: 0,
      dependencyCount: 0,
      circularDependencyCount: 0,
      averageCoupling: 0,
      complexityScore: 0,
      criticalViolations: 0,
      highViolations: 0,
      mediumViolations: 0,
      lowViolations: 0,
      circularity: 0,
      coupling: 0,
      cohesion: 0,
      healthScore: 0,
    },
    dependencyGraph: [],
    dependencies: [],
    totalDependencies: 0,
    violationCount: 0,
    moduleCount: 0,
    layerDistribution: EMPTY_LAYER_DISTRIBUTION,
    ...overrides,
  };
}

describe("src/utils/complexityCalculator", () => {
  describe("calculateCouplingScore", () => {
    it("returns 0 for a snapshot with no modules instead of NaN", () => {
      const snapshot = buildSnapshot();
      const score = calculateCouplingScore(snapshot);
      expect(score).toBe(0);
      expect(Number.isNaN(score)).toBe(false);
    });

    it("returns 0 for empty modules even with circular dependencies present", () => {
      const snapshot = buildSnapshot({
        metrics: {
          ...buildSnapshot().metrics,
          averageCoupling: 2.5,
          circularDependencyCount: 4,
        },
      });
      expect(calculateCouplingScore(snapshot)).toBe(0);
    });

    it("scores normally when modules exist", () => {
      const snapshot = buildSnapshot({
        modules: [
          {
            path: "a.ts",
            name: "a",
            type: "Services",
            size: 10,
            complexity: 1,
            dependencies: ["b"],
            dependents: [],
            exports: [],
            isCircular: false,
          },
          {
            path: "b.ts",
            name: "b",
            type: "Services",
            size: 10,
            complexity: 1,
            dependencies: [],
            dependents: ["a"],
            exports: [],
            isCircular: false,
          },
        ],
        metrics: {
          ...buildSnapshot().metrics,
          averageCoupling: 1.5,
          circularDependencyCount: 0,
        },
      });
      const score = calculateCouplingScore(snapshot);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("applies a penalty for modules with more than 5 dependencies", () => {
      const heavyModule = {
        path: "heavy.ts",
        name: "heavy",
        type: "Services",
        size: 10,
        complexity: 1,
        dependencies: ["a", "b", "c", "d", "e", "f"],
        dependents: [],
        exports: [],
        isCircular: false,
      };
      const lightModule = {
        path: "light.ts",
        name: "light",
        type: "Services",
        size: 10,
        complexity: 1,
        dependencies: [],
        dependents: ["heavy"],
        exports: [],
        isCircular: false,
      };
      const snapshot = buildSnapshot({
        modules: [heavyModule, lightModule],
      });
      const score = calculateCouplingScore(snapshot);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateRepositoryHealth", () => {
    it("does not produce NaN health for an empty snapshot", () => {
      const health = calculateRepositoryHealth(buildSnapshot());
      expect(Number.isNaN(health.health)).toBe(false);
      expect(health.health).toBeGreaterThanOrEqual(0);
      expect(health.health).toBeLessThanOrEqual(100);
      expect(Number.isNaN(health.coupling)).toBe(false);
      expect(health.coupling).toBe(0);
    });

    it("returns valid health metrics for a populated snapshot", () => {
      const snapshot = buildSnapshot({
        modules: [
          {
            path: "a.ts",
            name: "a",
            type: "Services",
            size: 10,
            complexity: 1,
            dependencies: [],
            dependents: ["b"],
            exports: [],
            isCircular: false,
          },
          {
            path: "b.ts",
            name: "b",
            type: "Services",
            size: 10,
            complexity: 1,
            dependencies: ["a"],
            dependents: [],
            exports: [],
            isCircular: false,
          },
        ],
        metrics: {
          ...buildSnapshot().metrics,
          moduleCount: 2,
          dependencyCount: 1,
          averageCoupling: 1,
        },
      });
      const health = calculateRepositoryHealth(snapshot);
      for (const key of ["modularity", "cohesion", "coupling", "complexity", "health"] as const) {
        expect(Number.isNaN(health[key])).toBe(false);
      }
    });
  });

  describe("calculateComplexityScore", () => {
    it("is finite for an empty snapshot", () => {
      const score = calculateComplexityScore(buildSnapshot());
      expect(Number.isNaN(score)).toBe(false);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateModularityScore", () => {
    it("returns 0 for a snapshot with no modules", () => {
      expect(calculateModularityScore(buildSnapshot())).toBe(0);
    });
  });

  describe("calculateCohesionScore", () => {
    it("returns 100 for a snapshot with no modules", () => {
      expect(calculateCohesionScore(buildSnapshot())).toBe(100);
    });
  });

  describe("compareHealthMetrics", () => {
    it("marks stable trend for close scores", () => {
      const base = buildSnapshot();
      const current = calculateRepositoryHealth(base);
      const previous = { ...current, health: current.health - 2 };
      const result = compareHealthMetrics(previous, current);
      expect(result.trend).toBe("Stable");
    });

    it("marks improving trend when score jumps", () => {
      const base = buildSnapshot();
      const current = calculateRepositoryHealth(base);
      const previous = { ...current, health: current.health - 10 };
      const result = compareHealthMetrics(previous, current);
      expect(result.trend).toBe("Improving");
    });
  });

  describe("getHealthStatus", () => {
    it("classifies scores into severity buckets", () => {
      expect(getHealthStatus(90)).toBe("Excellent");
      expect(getHealthStatus(70)).toBe("Good");
      expect(getHealthStatus(50)).toBe("Fair");
      expect(getHealthStatus(30)).toBe("Poor");
      expect(getHealthStatus(10)).toBe("Critical");
    });
  });

  describe("getHealthColor", () => {
    it("maps scores to tailwind color classes", () => {
      expect(getHealthColor(90)).toContain("emerald");
      expect(getHealthColor(70)).toContain("blue");
      expect(getHealthColor(50)).toContain("amber");
      expect(getHealthColor(30)).toContain("orange");
      expect(getHealthColor(10)).toContain("red");
    });
  });
});
