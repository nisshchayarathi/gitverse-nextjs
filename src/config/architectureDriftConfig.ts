/**
 * Architecture Drift Tracker Configuration
 * Defines thresholds, defaults, and parameters for drift analysis
 */

import { ArchitectureDriftPanelConfig, DriftSeverity } from "@/types/architectureDrift";

export const DRIFT_DETECTION_CONFIG: ArchitectureDriftPanelConfig = {
  enableHistoricalComparison: true,
  comparisonDays: 30,
  violationThreshold: 3,
  driftThreshold: 25,
  maxRecommendations: 5,
};

export const DRIFT_SCORE_THRESHOLDS = {
  critical: 70,
  high: 50,
  medium: 30,
  low: 0,
} as const;

export const VIOLATION_COUNT_THRESHOLDS: Record<DriftSeverity, number> = {
  Critical: 10,
  High: 6,
  Medium: 3,
  Low: 0,
};

export const COUPLING_SCORE_LIMITS = {
  healthy: 30,
  warning: 50,
  critical: 70,
} as const;

export const COHESION_SCORE_LIMITS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0,
} as const;

export const LAYER_DEPENDENCIES_ALLOWED: Record<string, string[]> = {
  UI: ["Services", "Utils", "Config"],
  Services: ["Database", "Utils", "Config", "Auth"],
  Database: [],
  Auth: ["Utils", "Config"],
  API: ["Services", "Utils", "Config", "Auth"],
  Utils: ["Config"],
  Config: [],
  Other: ["Utils", "Config"],
};

export const ANALYSIS_TIMEFRAMES = {
  week: 7,
  twoWeeks: 14,
  month: 30,
  quarter: 90,
  year: 365,
} as const;

export const ARCHITECTURE_EVOLUTION_PERIODS = [
  "7-days",
  "14-days",
  "30-days",
  "90-days",
  "1-year",
];

export const VIOLATION_SEVERITY_COLORS: Record<DriftSeverity, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#f59e0b",
  Low: "#10b981",
};

export const DRIFT_SCORE_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ea580c",
  critical: "#dc2626",
};

/**
 * Get thresholds based on repository size
 */
export function getScaledThresholds(repositorySize: "small" | "medium" | "large") {
  const baseThresholds = {
    small: {
      maxViolations: 5,
      maxCoupling: 40,
      maxDrift: 35,
    },
    medium: {
      maxViolations: 10,
      maxCoupling: 50,
      maxDrift: 30,
    },
    large: {
      maxViolations: 15,
      maxCoupling: 60,
      maxDrift: 25,
    },
  };

  return baseThresholds[repositorySize];
}

/**
 * Get risk level recommendation text
 */
export function getRiskLevelRecommendation(riskLevel: DriftSeverity): string {
  const recommendations: Record<DriftSeverity, string> = {
    Critical:
      "Immediate action required. Significant architectural degradation detected. Schedule refactoring immediately.",
    High: "Urgent review recommended. Multiple boundary violations need resolution within 1-2 sprints.",
    Medium:
      "Review suggested. Monitor drift closely and plan remediation within next quarter.",
    Low: "No immediate action needed. Continue monitoring architectural health.",
  };

  return recommendations[riskLevel];
}

/**
 * Get health score interpretation
 */
export function getHealthScoreInterpretation(score: number): {
  level: string;
  color: string;
  recommendation: string;
} {
  if (score >= 80) {
    return {
      level: "Excellent",
      color: "#10b981",
      recommendation: "Architecture is healthy. Maintain current practices.",
    };
  }
  if (score >= 60) {
    return {
      level: "Good",
      color: "#3b82f6",
      recommendation: "Architecture is sound. Minor improvements suggested.",
    };
  }
  if (score >= 40) {
    return {
      level: "Fair",
      color: "#f59e0b",
      recommendation: "Architecture needs attention. Plan improvements.",
    };
  }
  return {
    level: "Poor",
    color: "#dc2626",
    recommendation:
      "Architecture requires significant refactoring. Prioritize remediation.",
  };
}

export const DRIFT_DETECTION_CATEGORIES = [
  "Boundary Violations",
  "Coupling Analysis",
  "Module Organization",
  "Dependency Growth",
  "Circular Dependencies",
  "Layer Violations",
] as const;

export const COMMON_VIOLATIONS = {
  uiToDatabase: "UI layer directly accessing database",
  bypassingServices: "Bypassing service layer abstractions",
  crossLayerCoupling: "Unexpected cross-layer coupling",
  circularDeps: "Circular dependency detected",
  authBypass: "Bypassing authentication layer",
  directConfigAccess: "Accessing config from restricted layers",
};
