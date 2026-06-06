export interface ArchitectureModule {
  name: string;
  path: string;
  type: "Component" | "Service" | "Hook" | "Utility" | "API Route" | "Page" | "Unknown";
  size: number;
  complexity: number;
  dependencies: string[];
  dependents: string[];
  exports?: string[];
  isCircular?: boolean;
}

export interface ArchitectureSnapshot {
  timestamp: string;
  label: string;
  commitHash?: string;
  releaseTag?: string;
  modules: ArchitectureModule[];
  dependencies: Array<{ source: string; target: string; weight: number }>;
  metrics: {
    moduleCount: number;
    dependencyCount: number;
    averageCoupling: number;
    circularDependencyCount: number;
    complexityScore: number;
  };
}

export interface ComplexityMetrics {
  current: number;
  previous: number;
  change: number;
  percentageChange: number;
  trend: "Increasing" | "Decreasing" | "Stable";
}

export interface ArchitecturalChange {
  type: "Added" | "Removed" | "Modified";
  module: ArchitectureModule;
  timestamp?: string;
}

export interface DriftReport {
  from: ArchitectureSnapshot;
  to: ArchitectureSnapshot;
  addedModules: ArchitectureModule[];
  removedModules: ArchitectureModule[];
  modifiedModules: Array<{
    module: ArchitectureModule;
    previousComplexity: number;
    currentComplexity: number;
  }>;
  complexityMetrics: ComplexityMetrics;
  dependencyGrowth: {
    added: number;
    removed: number;
    percentageChange: number;
  };
  circularDependencyChanges: {
    added: number;
    removed: number;
  };
  riskLevel: "Low" | "Medium" | "High";
  riskFactors: string[];
  recommendations: string[];
}

export interface ArchitectureTimeline {
  snapshots: ArchitectureSnapshot[];
  driftReports: DriftReport[];
  currentIndex: number;
}

export interface ArchitecturalHealthMetrics {
  modularity: number;
  cohesion: number;
  coupling: number;
  complexity: number;
  health: number;
  trend: "Improving" | "Degrading" | "Stable";
}
