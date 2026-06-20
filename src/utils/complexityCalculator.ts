import { ArchitectureSnapshot, ArchitecturalHealthMetrics } from "@/types/architectureDrift";

export const calculateComplexityScore = (snapshot: ArchitectureSnapshot): number => {
  const { metrics } = snapshot;
  
  const moduleComplexity = Math.min(metrics.moduleCount / 100, 1) * 25;
  const dependencyComplexity = Math.min(metrics.dependencyCount / 200, 1) * 25;
  const couplingComplexity = Math.min(metrics.averageCoupling / 3, 1) * 25;
  const circularComplexity = Math.min(metrics.circularDependencyCount / 5, 1) * 25;

  return Math.round(moduleComplexity + dependencyComplexity + couplingComplexity + circularComplexity);
};

export const calculateModularityScore = (snapshot: ArchitectureSnapshot): number => {
  const { modules } = snapshot;
  
  if (modules.length === 0) return 0;

  const modulesByType = new Map<string, number>();
  modules.forEach((m) => {
    modulesByType.set(m.type, (modulesByType.get(m.type) || 0) + 1);
  });

  const typeBalance = 100 - Math.abs(50 - (modulesByType.size / 6) * 100);
  const avgDependencies =
    modules.reduce((sum, m) => sum + m.dependencies.length, 0) / modules.length;
  const dependencyBalance = Math.max(0, 100 - avgDependencies * 10);

  return Math.round((typeBalance + dependencyBalance) / 2);
};

export const calculateCohesionScore = (snapshot: ArchitectureSnapshot): number => {
  const { modules, metrics } = snapshot;
  
  if (modules.length === 0) return 100;

  const internalDeps = modules.filter((m) => m.dependents.length > 0).length;
  const internalDepPercentage = (internalDeps / modules.length) * 100;
  const couplingPenalty = Math.min(metrics.averageCoupling * 10, 30);

  return Math.round(internalDepPercentage - couplingPenalty);
};

export const calculateCouplingScore = (snapshot: ArchitectureSnapshot): number => {
  const { metrics, modules } = snapshot;
  
  const baseCoupling = Math.min((metrics.averageCoupling / 3) * 100, 100);
  const circularPenalty = metrics.circularDependencyCount * 5;
  const highDepModules = modules.filter((m) => m.dependencies.length > 5).length;
  const highDepPenalty = (highDepModules / modules.length) * 20;

  return Math.round(Math.min(100, baseCoupling + circularPenalty + highDepPenalty));
};

export const calculateRepositoryHealth = (snapshot: ArchitectureSnapshot): ArchitecturalHealthMetrics => {
  const complexity = calculateComplexityScore(snapshot);
  const modularity = calculateModularityScore(snapshot);
  const cohesion = calculateCohesionScore(snapshot);
  const coupling = calculateCouplingScore(snapshot);

  const healthScore = Math.round(
    (modularity * 0.3 + (100 - coupling) * 0.3 + cohesion * 0.2 + (100 - complexity) * 0.2),
  );

  return {
    modularity,
    cohesion,
    coupling,
    complexity,
    health: Math.max(0, Math.min(100, healthScore)),
    trend: "Stable",
  };
};

export const compareHealthMetrics = (
  previous: ArchitecturalHealthMetrics,
  current: ArchitecturalHealthMetrics,
): ArchitecturalHealthMetrics => {
  const trend =
    current.health > previous.health + 5
      ? "Improving"
      : current.health < previous.health - 5
        ? "Degrading"
        : "Stable";

  return {
    ...current,
    trend,
  };
};

export const getHealthStatus = (score: number): string => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Critical";
};

export const getHealthColor = (score: number): string => {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
};
