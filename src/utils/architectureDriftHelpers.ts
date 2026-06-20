/**
 * Architecture Drift Helper Utilities
 * Provides utility functions for drift analysis and visualization
 */

import {
  ArchitectureSnapshot,
  DriftAnalysis,
  ArchitectureEvolutionTrend,
  DriftSeverity,
  ArchitectureLayer,
} from "@/types/architectureDrift";
import { DRIFT_SCORE_THRESHOLDS } from "@/config/architectureDriftConfig";

/**
 * Formats drift score as a percentage with label
 */
export function formatDriftScore(score: number): {
  percentage: string;
  label: string;
  severity: DriftSeverity;
} {
  const percentage = `${Math.round(score)}%`;
  let label: DriftSeverity;
  let severity: DriftSeverity;

  if (score >= DRIFT_SCORE_THRESHOLDS.critical) {
    label = "Critical";
    severity = "Critical";
  } else if (score >= DRIFT_SCORE_THRESHOLDS.high) {
    label = "High";
    severity = "High";
  } else if (score >= DRIFT_SCORE_THRESHOLDS.medium) {
    label = "Medium";
    severity = "Medium";
  } else {
    label = "Low";
    severity = "Low";
  }

  return { percentage, label, severity };
}

/**
 * Formats coupling score with interpretation
 */
export function formatCouplingScore(score: number): {
  value: string;
  interpretation: string;
  status: "healthy" | "warning" | "critical";
} {
  const value = `${Math.round(score)}/100`;
  let interpretation: string;
  let status: "healthy" | "warning" | "critical";

  if (score <= 30) {
    interpretation = "Low coupling - excellent modularity";
    status = "healthy";
  } else if (score <= 50) {
    interpretation = "Moderate coupling - acceptable";
    status = "warning";
  } else {
    interpretation = "High coupling - refactoring recommended";
    status = "critical";
  }

  return { value, interpretation, status };
}

/**
 * Compares two snapshots and returns a summary
 */
export function compareShadshots(
  current: ArchitectureSnapshot,
  previous: ArchitectureSnapshot | null
): {
  dependencyChange: number;
  violationChange: number;
  moduleChange: number;
  summary: string;
} {
  if (!previous) {
    return {
      dependencyChange: 0,
      violationChange: 0,
      moduleChange: 0,
      summary: "No historical data available",
    };
  }

  const dependencyChange = current.totalDependencies - previous.totalDependencies;
  const violationChange = current.violationCount - previous.violationCount;
  const moduleChange = current.moduleCount - previous.moduleCount;

  let summary = "Architecture snapshot comparison:\n";
  summary += `Dependencies: ${dependencyChange > 0 ? "+" : ""}${dependencyChange}\n`;
  summary += `Violations: ${violationChange > 0 ? "+" : ""}${violationChange}\n`;
  summary += `Modules: ${moduleChange > 0 ? "+" : ""}${moduleChange}`;

  return {
    dependencyChange,
    violationChange,
    moduleChange,
    summary,
  };
}

/**
 * Generates time-series data for drift trends
 */
export function generateDriftTrends(
  snapshots: ArchitectureSnapshot[]
): ArchitectureEvolutionTrend[] {
  return snapshots
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((snapshot) => ({
      period: snapshot.snapshotDate,
      driftScore: calculateSnapshotDriftScore(snapshot),
      violationCount: snapshot.violationCount,
      moduleCount: snapshot.moduleCount,
      dependencyCount: snapshot.totalDependencies,
      healthScore: calculateHealthScore(snapshot),
    }));
}

/**
 * Calculates drift score for a single snapshot
 */
function calculateSnapshotDriftScore(snapshot: ArchitectureSnapshot): number {
  const violationRatio =
    (snapshot.violationCount / Math.max(snapshot.totalDependencies, 1)) * 100;
  const couplingScore =
    (snapshot.totalDependencies / Math.max(snapshot.moduleCount, 1)) * 20;

  return Math.min(100, Math.max(0, violationRatio * 0.6 + couplingScore * 0.4));
}

/**
 * Calculates health score for a snapshot
 */
function calculateHealthScore(snapshot: ArchitectureSnapshot): number {
  const violationPenalty =
    (snapshot.violationCount / Math.max(snapshot.moduleCount, 1)) * 20;
  const couplingPenalty =
    (snapshot.totalDependencies / Math.max(snapshot.moduleCount, 1)) * 10;

  return Math.max(
    0,
    Math.min(100, 100 - violationPenalty - couplingPenalty)
  );
}

/**
 * Detects anomalies in drift patterns
 */
export function detectDriftAnomalies(trends: ArchitectureEvolutionTrend[]): {
  anomaly: string;
  severity: DriftSeverity;
  timestamp: string;
}[] {
  const anomalies: { anomaly: string; severity: DriftSeverity; timestamp: string }[] =
    [];

  for (let i = 1; i < trends.length; i++) {
    const prev = trends[i - 1];
    const current = trends[i];

    // Spike detection
    const violationSpike = current.violationCount - prev.violationCount;
    if (violationSpike > 3) {
      anomalies.push({
        anomaly: `Violation spike detected (+${violationSpike} violations)`,
        severity: violationSpike > 5 ? "Critical" : "High",
        timestamp: current.period,
      });
    }

    // Sudden drift increase
    const driftIncrease = current.driftScore - prev.driftScore;
    if (driftIncrease > 20) {
      anomalies.push({
        anomaly: `Rapid drift increase (+${Math.round(driftIncrease)}%)`,
        severity: "High",
        timestamp: current.period,
      });
    }

    // Health degradation
    const healthDrop = prev.healthScore - current.healthScore;
    if (healthDrop > 15) {
      anomalies.push({
        anomaly: `Architecture health degradation (-${Math.round(healthDrop)}%)`,
        severity: "High",
        timestamp: current.period,
      });
    }
  }

  return anomalies;
}

/**
 * Generates summary statistics for a drift analysis
 */
export function generateDriftSummary(analysis: DriftAnalysis): {
  title: string;
  description: string;
  keyMetrics: Record<string, string | number>;
} {
  return {
    title: `Architecture Drift: ${analysis.riskLevel} Risk`,
    description: `Repository architecture shows ${analysis.violationsTrend} trend in violations with ${analysis.riskLevel} overall risk level.`,
    keyMetrics: {
      "Drift Score": `${analysis.driftScore.toFixed(1)}%`,
      "Risk Level": analysis.riskLevel,
      "New Violations": analysis.newViolations.length,
      "New Dependencies": analysis.newDependencies.length,
      "Coupling Score": `${analysis.couplingScore.toFixed(0)}/100`,
      "Module Growth": `${analysis.moduleGrowth.toFixed(1)}%`,
      "Analysis Period": `${analysis.timeframeDays} days`,
    },
  };
}

/**
 * Formats layer name for display
 */
export function formatLayerName(layer: ArchitectureLayer): string {
  const names: Record<ArchitectureLayer, string> = {
    UI: "User Interface",
    Services: "Business Services",
    Database: "Data Access",
    Auth: "Authentication",
    API: "API Gateway",
    Utils: "Utilities",
    Config: "Configuration",
    Other: "Other",
  };

  return names[layer];
}

/**
 * Checks if drift analysis indicates action needed
 */
export function requiresImmediateAction(analysis: DriftAnalysis): boolean {
  return (
    analysis.riskLevel === "Critical" ||
    analysis.driftScore > 70 ||
    analysis.newViolations.length > 5 ||
    analysis.violationsTrend === "increasing"
  );
}

/**
 * Gets estimated remediation time based on violation count
 */
export function estimateRemediationTime(violationCount: number): string {
  if (violationCount <= 2) return "1-2 hours";
  if (violationCount <= 5) return "1-2 days";
  if (violationCount <= 10) return "1-2 weeks";
  if (violationCount <= 20) return "2-4 weeks";
  return "1-2 months";
}

/**
 * Generates architeture evolution insights
 */
export function generateArchitectureInsights(
  trends: ArchitectureEvolutionTrend[]
): string[] {
  const insights: string[] = [];

  if (trends.length < 2) {
    return ["Insufficient historical data for trend analysis"];
  }

  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];

  // Trend analysis
  if (latest.violationCount > previous.violationCount) {
    insights.push(
      `⚠️ Violations increased from ${previous.violationCount} to ${latest.violationCount}`
    );
  } else if (latest.violationCount < previous.violationCount) {
    insights.push(
      `✅ Violations decreased from ${previous.violationCount} to ${latest.violationCount}`
    );
  }

  // Growth analysis
  if (latest.moduleCount > previous.moduleCount * 1.2) {
    insights.push(
      "📈 Significant module growth detected - review organization"
    );
  }

  // Health analysis
  if (latest.healthScore < 50) {
    insights.push("🔴 Architecture health score is below threshold");
  } else if (latest.healthScore >= 80) {
    insights.push("✨ Architecture health score is excellent");
  }

  // Dependency analysis
  const depGrowth = ((latest.dependencyCount - previous.dependencyCount) / previous.dependencyCount) * 100;
  if (depGrowth > 30) {
    insights.push(
      `🔗 Dependencies grew by ${depGrowth.toFixed(0)}% - monitor coupling`
    );
  }

  return insights.length > 0
    ? insights
    : ["Architecture remains stable - continue monitoring"];
}
