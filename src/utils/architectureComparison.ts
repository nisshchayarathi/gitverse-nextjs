import {
  ArchitectureSnapshot,
  DriftReport,
  ArchitecturalChange,
  ComplexityMetrics,
} from "@/types/architectureDrift";

const calculateRiskLevel = (
  complexityChange: number,
  dependencyGrowth: number,
  circularChanges: number,
): "Low" | "Medium" | "High" => {
  let riskScore = 0;

  if (complexityChange > 30) riskScore += 3;
  else if (complexityChange > 15) riskScore += 2;
  else if (complexityChange > 0) riskScore += 1;

  if (dependencyGrowth > 40) riskScore += 3;
  else if (dependencyGrowth > 20) riskScore += 2;
  else if (dependencyGrowth > 0) riskScore += 1;

  if (circularChanges > 0) riskScore += 2;

  if (riskScore >= 6) return "High";
  if (riskScore >= 3) return "Medium";
  return "Low";
};

const generateRiskFactors = (
  complexityChange: number,
  dependencyGrowth: number,
  circularAdded: number,
  addedModules: number,
  removedModules: number,
): string[] => {
  const factors: string[] = [];

  if (complexityChange > 25) {
    factors.push("Significant complexity increase detected.");
  }
  if (dependencyGrowth > 35) {
    factors.push("Dependencies grew substantially, increasing coupling.");
  }
  if (circularAdded > 0) {
    factors.push(`${circularAdded} new circular dependencies introduced.`);
  }
  if (addedModules > 10) {
    factors.push("Rapid module growth may indicate unclear architecture.");
  }
  if (removedModules > addedModules * 0.5) {
    factors.push("Significant module removal. Verify backward compatibility.");
  }

  return factors;
};

const generateRecommendations = (
  complexityChange: number,
  addedModules: number,
  circularAdded: number,
  avgCoupling: number,
): string[] => {
  const recommendations: string[] = [];

  if (complexityChange > 20) {
    recommendations.push("Review architectural boundaries and module responsibilities.");
  }
  if (addedModules > 8) {
    recommendations.push("Consider consolidating related modules to reduce fragmentation.");
  }
  if (circularAdded > 0) {
    recommendations.push("Refactor to break circular dependencies using interfaces or event buses.");
  }
  if (avgCoupling > 2.5) {
    recommendations.push("High coupling detected. Evaluate dependency injection or facade patterns.");
  }
  if (addedModules > 0 && circularAdded === 0) {
    recommendations.push("Maintain the current module organization — new additions follow good patterns.");
  }

  return recommendations.slice(0, 4);
};

export const compareSnapshots = (
  previousSnapshot: ArchitectureSnapshot,
  currentSnapshot: ArchitectureSnapshot,
): DriftReport => {
  const previousModuleMap = new Map(previousSnapshot.modules.map((m) => [m.path, m]));
  const currentModuleMap = new Map(currentSnapshot.modules.map((m) => [m.path, m]));

  const addedModules = Array.from(currentModuleMap.values()).filter(
    (m) => !previousModuleMap.has(m.path),
  );
  const removedModules = Array.from(previousModuleMap.values()).filter(
    (m) => !currentModuleMap.has(m.path),
  );
  const modifiedModules = Array.from(currentModuleMap.values())
    .filter((m) => previousModuleMap.has(m.path))
    .filter((m) => {
      const prev = previousModuleMap.get(m.path)!;
      return prev.complexity !== m.complexity || prev.dependencies.length !== m.dependencies.length;
    })
    .map((m) => ({
      module: m,
      previousComplexity: previousModuleMap.get(m.path)?.complexity || 0,
      currentComplexity: m.complexity,
    }));

  const complexityMetrics: ComplexityMetrics = {
    current: currentSnapshot.metrics.complexityScore,
    previous: previousSnapshot.metrics.complexityScore,
    change: currentSnapshot.metrics.complexityScore - previousSnapshot.metrics.complexityScore,
    percentageChange:
      previousSnapshot.metrics.complexityScore > 0
        ? ((currentSnapshot.metrics.complexityScore - previousSnapshot.metrics.complexityScore) /
            previousSnapshot.metrics.complexityScore) *
          100
        : 0,
    trend:
      currentSnapshot.metrics.complexityScore > previousSnapshot.metrics.complexityScore
        ? "Increasing"
        : currentSnapshot.metrics.complexityScore < previousSnapshot.metrics.complexityScore
          ? "Decreasing"
          : "Stable",
  };

  const dependencyGrowth = {
    added: Math.max(0, currentSnapshot.metrics.dependencyCount - previousSnapshot.metrics.dependencyCount),
    removed: Math.max(0, previousSnapshot.metrics.dependencyCount - currentSnapshot.metrics.dependencyCount),
    percentageChange:
      previousSnapshot.metrics.dependencyCount > 0
        ? ((currentSnapshot.metrics.dependencyCount - previousSnapshot.metrics.dependencyCount) /
            previousSnapshot.metrics.dependencyCount) *
          100
        : 0,
  };

  const circularDependencyChanges = {
    added: Math.max(
      0,
      currentSnapshot.metrics.circularDependencyCount - previousSnapshot.metrics.circularDependencyCount,
    ),
    removed: Math.max(
      0,
      previousSnapshot.metrics.circularDependencyCount - currentSnapshot.metrics.circularDependencyCount,
    ),
  };

  const riskLevel = calculateRiskLevel(
    complexityMetrics.percentageChange,
    dependencyGrowth.percentageChange,
    circularDependencyChanges.added,
  );

  const riskFactors = generateRiskFactors(
    complexityMetrics.percentageChange,
    dependencyGrowth.percentageChange,
    circularDependencyChanges.added,
    addedModules.length,
    removedModules.length,
  );

  const recommendations = generateRecommendations(
    complexityMetrics.percentageChange,
    addedModules.length,
    circularDependencyChanges.added,
    currentSnapshot.metrics.averageCoupling,
  );

  return {
    from: previousSnapshot,
    to: currentSnapshot,
    addedModules,
    removedModules,
    modifiedModules,
    complexityMetrics,
    dependencyGrowth,
    circularDependencyChanges,
    riskLevel,
    riskFactors,
    recommendations,
  };
};
