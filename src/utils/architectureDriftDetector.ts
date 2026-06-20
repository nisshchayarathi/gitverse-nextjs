/**
 * Architecture Drift Detection Engine
 * Analyzes repository structure and detects architectural violations
 */

import {
  ArchitectureSnapshot,
  DriftAnalysis,
  DependencyPath,
  BoundaryViolationType,
  ArchitectureLayer,
  DriftSeverity,
  DriftRecommendation,
} from "@/types/architectureDrift";
import { RepositoryAnalysisData } from "@/types/contributionPath";

const FORBIDDEN_DEPENDENCIES: Record<string, ArchitectureLayer[]> = {
  UI: ["Database", "Config"],
  Auth: ["Database"],
  Services: [],
  Database: [],
  API: [],
  Utils: [],
  Config: [],
  Other: [],
};

/**
 * Analyzes repository structure and generates architecture snapshot
 */
export function generateArchitectureSnapshot(
  repository: RepositoryAnalysisData | undefined,
  repositoryId: string
): ArchitectureSnapshot {
  const dependencyGraph: DependencyPath[] = [];
  const layerDistribution: Record<ArchitectureLayer, number> = {
    UI: 0,
    Services: 0,
    Database: 0,
    Auth: 0,
    API: 0,
    Utils: 0,
    Config: 0,
    Other: 0,
  };

  if (repository?.files) {
    // Normalize file paths for layer categorization
    const filePaths = (repository.files || []).map((file) =>
      typeof file === "string" ? file : file.path
    );
    const filesByLayer = categorizeFilesByLayer(filePaths);

    Object.entries(filesByLayer).forEach(([layer, layerFiles]) => {
      layerDistribution[layer as ArchitectureLayer] = layerFiles.length;
    });

    // Build dependency graph
    Object.entries(filesByLayer).forEach(([sourceLayer, sourceFiles]) => {
      sourceFiles.forEach((sourceFile) => {
        Object.entries(filesByLayer).forEach(([targetLayer, targetFiles]) => {
          if (sourceLayer !== targetLayer) {
            targetFiles.forEach((targetFile) => {
              if (hasImportDependency(sourceFile, targetFile)) {
                const isViolation = checkBoundaryViolation(
                  sourceLayer as ArchitectureLayer,
                  targetLayer as ArchitectureLayer
                );
                const violationType = isViolation
                  ? detectViolationType(
                      sourceLayer as ArchitectureLayer,
                      targetLayer as ArchitectureLayer
                    )
                  : undefined;

                dependencyGraph.push({
                  source: sourceFile,
                  target: targetFile,
                  layer: sourceLayer as ArchitectureLayer,
                  isViolation,
                  violationType,
                });
              }
            });
          }
        });
      });
    });
  }

  const violationCount = dependencyGraph.filter((dep) => dep.isViolation).length;
  const moduleCount = Object.values(layerDistribution).reduce((a, b) => a + b, 0);
  const totalDependencies = dependencyGraph.length;
  const averageCoupling = moduleCount > 0 ? totalDependencies / moduleCount : 0;

  const metrics = {
    moduleCount,
    totalDependencies,
    dependencyCount: totalDependencies,
    circularDependencyCount: 0,
    averageCoupling,
    complexityScore: Math.round(averageCoupling * 10),
    criticalViolations: Math.floor(violationCount * 0.1),
    highViolations: Math.floor(violationCount * 0.3),
    mediumViolations: Math.floor(violationCount * 0.4),
    lowViolations: Math.floor(violationCount * 0.2),
    circularity: 0,
    coupling: Math.min(100, averageCoupling * 10),
    cohesion: Math.max(0, 100 - (violationCount / Math.max(totalDependencies, 1)) * 100),
    healthScore: Math.max(0, 100 - (violationCount / Math.max(moduleCount, 1)) * 20),
  };

  return {
    id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    repositoryId,
    timestamp: new Date(),
    snapshotDate: new Date().toISOString().split("T")[0],
    label: "Current Snapshot",
    dependencyGraph,
    dependencies: dependencyGraph.map(({ source, target }) => ({ source, target, weight: 1 })),
    modules: [],
    metrics,
    totalDependencies,
    violationCount,
    moduleCount,
    layerDistribution,
    metadata: {
      analysisVersion: "1.0.0",
      commitHash: repository?.commitHash,
      analysisDurationMs: Date.now(),
    },
  };
}

/**
 * Compares two architecture snapshots and detects drift
 */
export function analyzeDrift(
  current: ArchitectureSnapshot,
  previous: ArchitectureSnapshot | null
): DriftAnalysis {
  const newDependencies: DependencyPath[] = [];
  const removedDependencies: DependencyPath[] = [];
  const newViolations: DependencyPath[] = [];

  if (previous) {
    // Find new dependencies
    current.dependencyGraph.forEach((dep) => {
      const exists = previous.dependencyGraph.some(
        (prev) => prev.source === dep.source && prev.target === dep.target
      );
      if (!exists) {
        newDependencies.push(dep);
        if (dep.isViolation) {
          newViolations.push(dep);
        }
      }
    });

    // Find removed dependencies
    previous.dependencyGraph.forEach((dep) => {
      const exists = current.dependencyGraph.some(
        (curr) => curr.source === dep.source && curr.target === dep.target
      );
      if (!exists) {
        removedDependencies.push(dep);
      }
    });
  }

  const driftScore = calculateDriftScore(
    current,
    previous,
    newDependencies,
    newViolations
  );
  const riskLevel = calculateRiskLevel(driftScore, current.violationCount);
  const moduleGrowth = previous
    ? ((current.moduleCount - previous.moduleCount) / previous.moduleCount) * 100
    : 0;
  const couplingScore = calculateCouplingScore(current);
  const violationsTrend = detectViolationsTrend(
    previous?.violationCount || 0,
    current.violationCount,
    newViolations.length
  );

  const recommendations = generateRecommendations(
    current,
    newViolations,
    couplingScore,
    moduleGrowth
  );

  return {
    currentSnapshot: current,
    previousSnapshot: previous || null,
    driftScore,
    riskLevel,
    newDependencies,
    removedDependencies,
    newViolations,
    violationsTrend,
    moduleGrowth,
    couplingScore,
    timeframeDays: previous
      ? Math.floor(
          (current.timestamp.getTime() - previous.timestamp.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0,
    recommendations,
  };
}

/**
 * Categorizes files by architecture layer
 */
function categorizeFilesByLayer(
  files: string[]
): Record<ArchitectureLayer, string[]> {
  const layers: Record<ArchitectureLayer, string[]> = {
    UI: [],
    Services: [],
    Database: [],
    Auth: [],
    API: [],
    Utils: [],
    Config: [],
    Other: [],
  };

  files.forEach((file) => {
    if (
      file.includes("/components/") ||
      file.includes("/pages/") ||
      file.includes("page.tsx") ||
      file.includes("layout.tsx")
    ) {
      layers.UI.push(file);
    } else if (
      file.includes("/services/") ||
      file.includes("Service.ts") ||
      file.includes("service.ts")
    ) {
      layers.Services.push(file);
    } else if (
      file.includes("/db/") ||
      file.includes("prisma") ||
      file.includes("database")
    ) {
      layers.Database.push(file);
    } else if (file.includes("auth") || file.includes("Auth")) {
      layers.Auth.push(file);
    } else if (
      file.includes("/api/") ||
      file.includes("route.ts") ||
      file.includes("route.js")
    ) {
      layers.API.push(file);
    } else if (
      file.includes("/utils/") ||
      file.includes("util") ||
      file.includes("helper")
    ) {
      layers.Utils.push(file);
    } else if (file.includes("/config/") || file.includes("config")) {
      layers.Config.push(file);
    } else {
      layers.Other.push(file);
    }
  });

  return layers;
}

/**
 * Simulates import dependency detection
 */
function hasImportDependency(sourceFile: string, targetFile: string): boolean {
  return (
    Math.random() > 0.7 &&
    sourceFile !== targetFile &&
    sourceFile.includes("/") &&
    targetFile.includes("/")
  );
}

/**
 * Checks if dependency violates architectural boundaries
 */
function checkBoundaryViolation(
  source: ArchitectureLayer,
  target: ArchitectureLayer
): boolean {
  const forbidden = FORBIDDEN_DEPENDENCIES[source] || [];
  return forbidden.includes(target);
}

/**
 * Detects the type of violation
 */
function detectViolationType(
  source: ArchitectureLayer,
  target: ArchitectureLayer
): BoundaryViolationType {
  if (source === "UI" && target === "Database") {
    return "DirectUIToDatabase";
  }
  if (source === "UI" && target === "Services") {
    return "ServiceLayerBypass";
  }
  return "CrossLayerDependency";
}

/**
 * Calculates drift score (0-100)
 */
function calculateDriftScore(
  current: ArchitectureSnapshot,
  previous: ArchitectureSnapshot | null,
  newDependencies: DependencyPath[],
  newViolations: DependencyPath[]
): number {
  if (!previous) return 0;

  const violationGrowth =
    current.violationCount > previous.violationCount
      ? ((current.violationCount - previous.violationCount) /
          (previous.violationCount || 1)) *
        100
      : 0;
  const newViolationWeight = (newViolations.length / Math.max(newDependencies.length, 1)) * 100;
  const dependencyGrowth =
    ((current.totalDependencies - previous.totalDependencies) /
      (previous.totalDependencies || 1)) *
    100;

  return Math.min(
    100,
    Math.max(0, violationGrowth * 0.4 + newViolationWeight * 0.4 + dependencyGrowth * 0.2)
  );
}

/**
 * Calculates risk level based on drift score
 */
function calculateRiskLevel(
  driftScore: number,
  violationCount: number
): DriftSeverity {
  if (driftScore >= 70 || violationCount >= 10) return "Critical";
  if (driftScore >= 50 || violationCount >= 6) return "High";
  if (driftScore >= 30 || violationCount >= 3) return "Medium";
  return "Low";
}

/**
 * Calculates coupling score (0-100)
 */
function calculateCouplingScore(snapshot: ArchitectureSnapshot): number {
  const avgDependenciesPerModule =
    snapshot.totalDependencies / Math.max(snapshot.moduleCount, 1);
  return Math.min(
    100,
    (avgDependenciesPerModule / 5) * 100 + (snapshot.violationCount / Math.max(snapshot.totalDependencies, 1)) * 50
  );
}

/**
 * Detects violation trend
 */
function detectViolationsTrend(
  previousCount: number,
  currentCount: number,
  newViolations: number
): "increasing" | "decreasing" | "stable" {
  if (newViolations > 2) return "increasing";
  if (currentCount < previousCount) return "decreasing";
  return "stable";
}

/**
 * Generates actionable recommendations
 */
function generateRecommendations(
  snapshot: ArchitectureSnapshot,
  newViolations: DependencyPath[],
  couplingScore: number,
  moduleGrowth: number
): DriftRecommendation[] {
  const recommendations: DriftRecommendation[] = [];

  if (newViolations.length > 0) {
    recommendations.push({
      priority: "Critical",
      title: "Address New Architectural Violations",
      description: `${newViolations.length} new boundary violations detected. Review and refactor to restore architectural integrity.`,
      affectedModules: newViolations
        .slice(0, 3)
        .map((v) => v.source),
      action:
        "Review import statements and enforce architectural boundaries through code organization.",
      estimatedEffort: "High",
    });
  }

  if (couplingScore > 70) {
    recommendations.push({
      priority: "High",
      title: "Reduce Coupling",
      description:
        "Module coupling is high. Consider introducing abstraction layers or service facades.",
      affectedModules: [],
      action:
        "Implement facade pattern or dependency injection to decouple modules.",
      estimatedEffort: "Medium",
    });
  }

  if (moduleGrowth > 30) {
    recommendations.push({
      priority: "Medium",
      title: "Review Module Organization",
      description: `Module count grew by ${moduleGrowth.toFixed(0)}%. Consider reorganizing to maintain clarity.`,
      affectedModules: [],
      action:
        "Analyze new modules and group related functionality into cohesive packages.",
      estimatedEffort: "Medium",
    });
  }

  if (snapshot.violationCount > 5) {
    recommendations.push({
      priority: "High",
      title: "Enforce Architectural Governance",
      description:
        "Multiple violations suggest need for stricter architectural enforcement.",
      affectedModules: [],
      action:
        "Implement ESLint rules, import restrictions, or path aliases to enforce boundaries.",
      estimatedEffort: "High",
    });
  }

  return recommendations.slice(0, 5);
}

/**
 * Calculates architecture health metrics
 */
export function calculateArchitectureMetrics(
  snapshot: ArchitectureSnapshot
): Record<string, number> {
  return {
    totalDependencies: snapshot.totalDependencies,
    criticalViolations: Math.floor(snapshot.violationCount * 0.1),
    highViolations: Math.floor(snapshot.violationCount * 0.3),
    mediumViolations: Math.floor(snapshot.violationCount * 0.4),
    lowViolations: Math.floor(snapshot.violationCount * 0.2),
    circularity:
      (snapshot.dependencyGraph.filter((d) => d.violationType === "CircularDependency")
        .length /
        Math.max(snapshot.totalDependencies, 1)) *
      100,
    coupling: Math.min(
      100,
      (snapshot.totalDependencies / Math.max(snapshot.moduleCount, 1)) * 20
    ),
    cohesion: Math.max(
      0,
      100 -
        (snapshot.violationCount /
          Math.max(snapshot.totalDependencies, 1)) *
          100
    ),
    healthScore: Math.max(
      0,
      100 - (snapshot.violationCount / Math.max(snapshot.moduleCount, 1)) * 20
    ),
  };
}
