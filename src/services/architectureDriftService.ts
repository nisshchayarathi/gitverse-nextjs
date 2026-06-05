import { RepositoryFile } from "@/types/firstPRSimulator";
import {
  ArchitectureSnapshot,
  DriftReport,
  ArchitectureTimeline,
  ArchitecturalHealthMetrics,
} from "@/types/architectureDrift";
import { generateArchitectureSnapshot } from "@/utils/snapshotGenerator";
import { compareSnapshots } from "@/utils/architectureComparison";
import {
  calculateRepositoryHealth,
  compareHealthMetrics,
  calculateComplexityScore,
} from "@/utils/complexityCalculator";

export const buildArchitectureDriftReport = (files: RepositoryFile[]): {
  currentSnapshot: ArchitectureSnapshot;
  health: ArchitecturalHealthMetrics;
} => {
  const currentSnapshot = generateArchitectureSnapshot(
    files,
    "Current Architecture",
  );

  const health = calculateRepositoryHealth(currentSnapshot);

  return {
    currentSnapshot,
    health,
  };
};

export const buildDriftTimeline = (
  fileSnapshots: Array<{ files: RepositoryFile[]; label: string; commitHash?: string }>,
): ArchitectureTimeline => {
  const snapshots = fileSnapshots.map((snapshot) =>
    generateArchitectureSnapshot(
      snapshot.files,
      snapshot.label,
      snapshot.commitHash,
    ),
  );

  const driftReports: DriftReport[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    driftReports.push(compareSnapshots(snapshots[i - 1], snapshots[i]));
  }

  return {
    snapshots,
    driftReports,
    currentIndex: snapshots.length - 1,
  };
};

export const detectArchitecturalDrift = (
  previousSnapshot: ArchitectureSnapshot,
  currentSnapshot: ArchitectureSnapshot,
): DriftReport => {
  return compareSnapshots(previousSnapshot, currentSnapshot);
};

export const getSummaryMetrics = (snapshot: ArchitectureSnapshot) => {
  return {
    modules: snapshot.metrics.moduleCount,
    dependencies: snapshot.metrics.dependencyCount,
    complexity: snapshot.metrics.complexityScore,
    circulars: snapshot.metrics.circularDependencyCount,
    avgCoupling: snapshot.metrics.averageCoupling.toFixed(2),
  };
};

export const getRecommendedActions = (
  report: DriftReport,
): Array<{ action: string; priority: "High" | "Medium" | "Low" }> => {
  const actions: Array<{ action: string; priority: "High" | "Medium" | "Low" }> = [];

  if (report.riskLevel === "High") {
    actions.push({
      action: "Conduct architecture review immediately",
      priority: "High",
    });
  }

  if (report.complexityMetrics.percentageChange > 20) {
    actions.push({
      action: "Review and refactor high-complexity modules",
      priority: "High",
    });
  }

  if (report.circularDependencyChanges.added > 0) {
    actions.push({
      action: "Eliminate newly introduced circular dependencies",
      priority: "High",
    });
  }

  if (report.addedModules.length > 10) {
    actions.push({
      action: "Consolidate related modules",
      priority: "Medium",
    });
  }

  if (report.dependencyGrowth.percentageChange > 30) {
    actions.push({
      action: "Reduce coupling by introducing service layers",
      priority: "Medium",
    });
  }

  return actions.slice(0, 5);
};

export const buildHealthTimeline = (
  snapshots: ArchitectureSnapshot[],
): Array<{ label: string; score: number; trend: string }> => {
  return snapshots.map((snapshot) => ({
    label: snapshot.label,
    score: calculateComplexityScore(snapshot),
    trend: snapshot.commitHash ? `Commit: ${snapshot.commitHash.slice(0, 7)}` : "Snapshot",
  }));
};
