/**
 * Architecture Drift Tracker Types
 * Defines types for monitoring architectural evolution and detecting decay
 */

export type ArchitectureLayer = "UI" | "Services" | "Database" | "Auth" | "API" | "Utils" | "Config" | "Other";

export type DriftSeverity = "Critical" | "High" | "Medium" | "Low";

export type BoundaryViolationType = "CrossLayerDependency" | "UnexpectedCoupling" | "CircularDependency" | "DirectUIToDatabase" | "ServiceLayerBypass" | "UnauthorizedAccess";

export interface DependencyPath {
  source: string;
  target: string;
  layer: ArchitectureLayer;
  isViolation: boolean;
  violationType?: BoundaryViolationType;
}

export interface ArchitectureModule {
  path: string;
  name: string;
  language?: string;
  type: string;
  size: number;
  complexity: number;
  dependencies: string[];
  dependents: string[];
  exports: string[];
  isCircular: boolean;
}

export interface RepositoryAnalysisData {
  repositoryId?: string;
  files?: string[];
  commitHash?: string;
  analysisDate?: Date;
  totalFiles?: number;
  insights?: string[];
  metadata?: Record<string, unknown>;
}

export interface ArchitecturalHealthMetrics {
  modularity: number;
  cohesion: number;
  coupling: number;
  complexity: number;
  health: number;
  trend: "Improving" | "Degrading" | "Stable";
}

export interface ComplexityMetrics {
  current: number;
  previous: number;
  change: number;
  percentageChange: number;
  trend: "Increasing" | "Decreasing" | "Stable";
}

export interface ArchitecturalChange {
  module: ArchitectureModule;
  previousComplexity: number;
  currentComplexity: number;
}

export interface DriftReport {
  from: ArchitectureSnapshot;
  to: ArchitectureSnapshot;
  addedModules: ArchitectureModule[];
  removedModules: ArchitectureModule[];
  modifiedModules: ArchitecturalChange[];
  complexityMetrics: ComplexityMetrics;
  dependencyGrowth: { added: number; removed: number; percentageChange: number };
  circularDependencyChanges: { added: number; removed: number };
  riskLevel: "Low" | "Medium" | "High";
  riskFactors: string[];
  recommendations: string[];
}

export interface ArchitectureTimeline {
  snapshots: ArchitectureSnapshot[];
  driftReports: DriftReport[];
  currentIndex: number;
}

export interface DependencyLink {
  source: string;
  target: string;
  weight: number;
}

export interface ArchitectureSnapshot {
  id?: string;
  repositoryId?: string;
  commitHash?: string;
  timestamp: Date;
  snapshotDate: string;
  label: string;
  releaseTag?: string;
  modules: ArchitectureModule[];
  metrics: ArchitectureMetrics;
  dependencyGraph: DependencyPath[];
  dependencies: DependencyLink[];
  totalDependencies: number;
  violationCount: number;
  moduleCount: number;
  layerDistribution: Record<ArchitectureLayer, number>;
  metadata?: {
    analysisVersion: string;
    commitHash?: string;
    analysisDurationMs: number;
  };
}

export interface DriftAnalysis {
  currentSnapshot: ArchitectureSnapshot;
  previousSnapshot: ArchitectureSnapshot | null;
  driftScore: number; // 0-100
  riskLevel: DriftSeverity;
  newDependencies: DependencyPath[];
  removedDependencies: DependencyPath[];
  newViolations: DependencyPath[];
  violationsTrend: "increasing" | "decreasing" | "stable";
  moduleGrowth: number; // percentage
  couplingScore: number; // 0-100
  timeframeDays: number;
  recommendations: DriftRecommendation[];
}

export interface DriftRecommendation {
  priority: DriftSeverity;
  title: string;
  description: string;
  affectedModules: string[];
  action: string;
  estimatedEffort: "Low" | "Medium" | "High";
}

export interface ArchitectureMetrics {
  moduleCount: number;
  totalDependencies: number;
  dependencyCount: number;
  circularDependencyCount: number;
  averageCoupling: number;
  complexityScore: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  circularity: number; // percentage
  coupling: number; // 0-100
  cohesion: number; // 0-100
  healthScore: number; // 0-100
}

export interface ArchitectureDriftPanelConfig {
  enableHistoricalComparison: boolean;
  comparisonDays: number;
  violationThreshold: number;
  driftThreshold: number;
  maxRecommendations: number;
}

export interface ArchitectureEvolutionTrend {
  period: string;
  driftScore: number;
  violationCount: number;
  moduleCount: number;
  dependencyCount: number;
  healthScore: number;
}

export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  "UI",
  "Services",
  "Database",
  "Auth",
  "API",
  "Utils",
  "Config",
  "Other",
];

export const BOUNDARY_VIOLATIONS: Record<BoundaryViolationType, string> = {
  CrossLayerDependency: "Module depends on layers it shouldn't access",
  UnexpectedCoupling: "High coupling between unrelated modules",
  CircularDependency: "Circular dependency detected in module graph",
  DirectUIToDatabase: "UI layer accessing database directly",
  ServiceLayerBypass: "Features bypassing service layer abstractions",
  UnauthorizedAccess: "Unauthorized module access detected",
};
