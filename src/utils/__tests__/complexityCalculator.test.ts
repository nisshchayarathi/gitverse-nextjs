import {
  calculateCouplingScore,
  calculateRepositoryHealth,
} from "../complexityCalculator";
import type {
  ArchitectureSnapshot,
  ArchitectureModule,
  ArchitectureMetrics,
} from "@/types/architectureDrift";

const makeMetrics = (
  overrides: Partial<ArchitectureMetrics> = {},
): ArchitectureMetrics => ({
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
  ...overrides,
});

const makeModule = (
  overrides: Partial<ArchitectureModule> = {},
): ArchitectureModule => ({
  path: "src/example.ts",
  name: "example",
  type: "Utils",
  size: 1000,
  complexity: 1,
  dependencies: [],
  dependents: [],
  exports: [],
  isCircular: false,
  ...overrides,
});

const makeSnapshot = (
  modules: ArchitectureModule[],
  metrics: Partial<ArchitectureMetrics> = {},
): ArchitectureSnapshot => ({
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
  snapshotDate: "2026-01-01",
  label: "test",
  modules,
  metrics: makeMetrics(metrics),
  dependencyGraph: [],
  dependencies: [],
  totalDependencies: 0,
  violationCount: 0,
  moduleCount: modules.length,
  layerDistribution: {
    UI: 0,
    Services: 0,
    Database: 0,
    Auth: 0,
    API: 0,
    Utils: 0,
    Config: 0,
    Other: 0,
  },
});

describe("calculateCouplingScore", () => {
  it("returns a finite number (not NaN) for an empty modules array (regression for #2500)", () => {
    const score = calculateCouplingScore(makeSnapshot([]));
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0);
  });

  it("computes the high-dependency penalty for non-empty modules", () => {
    const snapshot = makeSnapshot([
      makeModule({ dependencies: [] }),
      makeModule({ dependencies: ["a", "b", "c", "d", "e", "f"] }), // > 5 deps
    ]);
    // baseCoupling 0 + circularPenalty 0 + (1/2)*20 = 10
    expect(calculateCouplingScore(snapshot)).toBe(10);
  });

  it("caps the coupling score at 100", () => {
    const snapshot = makeSnapshot(
      [makeModule({ dependencies: ["a", "b", "c", "d", "e", "f"] })],
      { averageCoupling: 9, circularDependencyCount: 30 },
    );
    expect(calculateCouplingScore(snapshot)).toBe(100);
  });
});

describe("calculateRepositoryHealth", () => {
  it("produces a finite health score for an empty-modules snapshot", () => {
    const health = calculateRepositoryHealth(makeSnapshot([]));
    expect(Number.isNaN(health.health)).toBe(false);
    expect(health.health).toBeGreaterThanOrEqual(0);
    expect(health.health).toBeLessThanOrEqual(100);
    expect(Number.isNaN(health.coupling)).toBe(false);
  });
});
