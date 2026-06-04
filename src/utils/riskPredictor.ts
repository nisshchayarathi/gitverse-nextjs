/**
 * Risk Prediction Utilities
 * 
 * Predicts maintenance risk based on complexity growth,
 * dependency patterns, churn, and other factors.
 */

import {
  RiskLevel,
  RiskIndicator,
  ForecastRecommendation,
  TrendAnalysis,
} from "@/types/hotspotForecast";

/**
 * Risk scoring weights
 */
const RISK_WEIGHTS = {
  complexity: 0.25,
  dependencies: 0.2,
  churn: 0.2,
  architecturalDrift: 0.15,
  size: 0.1,
  contributors: 0.1,
};

/**
 * Thresholds for risk classification
 */
const RISK_THRESHOLDS = {
  complexity: { critical: 90, high: 70, medium: 50, low: 30 },
  dependencies: { critical: 50, high: 30, medium: 20, low: 10 },
  churn: { critical: 80, high: 60, medium: 40, low: 20 },
  drift: { critical: 80, high: 60, medium: 40, low: 20 },
  size: { critical: 2000, high: 1500, medium: 1000, low: 500 },
};

/**
 * Calculates risk score based on multiple factors (0-100)
 */
export function calculateRiskScore(
  complexity: number = 0,
  dependencies: number = 0,
  churn: number = 0,
  drift: number = 0,
  size: number = 0,
  contributorConcentration: number = 0 // 0-100, how concentrated contributors are
): number {
  // Normalize factors to 0-100 scale
  const complexityScore = Math.min(100, complexity);
  const dependencyScore = Math.min(100, Math.floor((dependencies / 50) * 100));
  const churnScore = Math.min(100, Math.floor(churn));
  const driftScore = Math.min(100, drift);
  const sizeScore = Math.min(100, Math.floor((size / 2000) * 100));

  // Factor in contributor concentration (single person = high risk)
  const concentrationRisk = Math.min(100, contributorConcentration);

  const score =
    complexityScore * RISK_WEIGHTS.complexity +
    dependencyScore * RISK_WEIGHTS.dependencies +
    churnScore * RISK_WEIGHTS.churn +
    driftScore * RISK_WEIGHTS.architecturalDrift +
    sizeScore * RISK_WEIGHTS.size +
    concentrationRisk * 0.1;

  return Math.min(100, Math.round(score));
}

/**
 * Classifies risk level based on score
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Generates risk indicators for detailed analysis
 */
export function generateRiskIndicators(
  complexity: number,
  dependencies: number,
  churn: number,
  drift: number,
  size: number,
  commitActivity: number,
  contributorCount: number,
  totalContributors: number
): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];

  // Complexity indicator
  if (complexity > RISK_THRESHOLDS.complexity.critical) {
    indicators.push({
      name: "High Complexity",
      currentValue: complexity,
      threshold: RISK_THRESHOLDS.complexity.critical,
      severity: "CRITICAL",
      impact: "Module is difficult to understand and modify safely",
    });
  } else if (complexity > RISK_THRESHOLDS.complexity.high) {
    indicators.push({
      name: "High Complexity",
      currentValue: complexity,
      threshold: RISK_THRESHOLDS.complexity.high,
      severity: "HIGH",
      impact: "Module complexity is above recommended levels",
    });
  }

  // Dependency indicator
  if (dependencies > RISK_THRESHOLDS.dependencies.critical) {
    indicators.push({
      name: "High Dependency Count",
      currentValue: dependencies,
      threshold: RISK_THRESHOLDS.dependencies.critical,
      severity: "CRITICAL",
      impact: "Module has excessive external dependencies",
    });
  } else if (dependencies > RISK_THRESHOLDS.dependencies.high) {
    indicators.push({
      name: "High Dependency Count",
      currentValue: dependencies,
      threshold: RISK_THRESHOLDS.dependencies.high,
      severity: "HIGH",
      impact: "Module is tightly coupled with other modules",
    });
  }

  // Churn indicator
  if (churn > RISK_THRESHOLDS.churn.critical) {
    indicators.push({
      name: "High Code Churn",
      currentValue: churn,
      threshold: RISK_THRESHOLDS.churn.critical,
      severity: "CRITICAL",
      impact: "Module is frequently modified, indicating instability",
    });
  } else if (churn > RISK_THRESHOLDS.churn.high) {
    indicators.push({
      name: "High Code Churn",
      currentValue: churn,
      threshold: RISK_THRESHOLDS.churn.high,
      severity: "HIGH",
      impact: "Module changes frequently, suggesting maintenance issues",
    });
  }

  // Architectural drift indicator
  if (drift > RISK_THRESHOLDS.drift.critical) {
    indicators.push({
      name: "Architectural Drift",
      currentValue: drift,
      threshold: RISK_THRESHOLDS.drift.critical,
      severity: "CRITICAL",
      impact: "Module deviates significantly from repository architecture",
    });
  } else if (drift > RISK_THRESHOLDS.drift.high) {
    indicators.push({
      name: "Architectural Drift",
      currentValue: drift,
      threshold: RISK_THRESHOLDS.drift.high,
      severity: "HIGH",
      impact: "Module has architectural inconsistencies",
    });
  }

  // Size indicator
  if (size > RISK_THRESHOLDS.size.critical) {
    indicators.push({
      name: "Large Module",
      currentValue: size,
      threshold: RISK_THRESHOLDS.size.critical,
      severity: "CRITICAL",
      impact: "Module is too large and should be split",
    });
  } else if (size > RISK_THRESHOLDS.size.high) {
    indicators.push({
      name: "Large Module",
      currentValue: size,
      threshold: RISK_THRESHOLDS.size.high,
      severity: "HIGH",
      impact: "Module size is above recommended limits",
    });
  }

  // Contributor concentration indicator
  const concentrationRatio =
    totalContributors > 0 ? (1 - contributorCount / totalContributors) * 100 : 0;
  if (contributorCount === 1) {
    indicators.push({
      name: "Single Contributor",
      currentValue: 100,
      threshold: 30,
      severity: "HIGH",
      impact: "Module is maintained by only one person (knowledge risk)",
    });
  } else if (concentrationRatio > 70) {
    indicators.push({
      name: "Contributor Concentration",
      currentValue: concentrationRatio,
      threshold: 70,
      severity: "MEDIUM",
      impact: "Module has limited contributor diversity",
    });
  }

  // Activity indicator
  if (commitActivity < 1) {
    indicators.push({
      name: "Low Maintenance Activity",
      currentValue: commitActivity,
      threshold: 1,
      severity: "MEDIUM",
      impact: "Module is rarely maintained, may contain outdated code",
    });
  }

  return indicators;
}

/**
 * Predicts confidence score for forecast
 */
export function calculateConfidenceScore(
  dataPoints: number,
  volatility: number,
  trendStrength: number // R² value
): number {
  // More data points = higher confidence
  const dataConfidence = Math.min(100, dataPoints * 10);

  // Lower volatility = higher confidence
  const volatilityConfidence = Math.max(20, 100 - volatility * 10);

  // Stronger trend = higher confidence
  const trendConfidence = trendStrength * 100;

  const confidence = (dataConfidence + volatilityConfidence + trendConfidence) / 3;

  return Math.round(Math.max(20, Math.min(100, confidence)));
}

/**
 * Predicts future risk based on trends
 */
export function predictFutureRisk(
  currentRiskScore: number,
  complexityGrowth: number,
  dependencyGrowth: number,
  churnGrowth: number,
  forecastMonths: number
): { projectedScore: number; projectedRisk: RiskLevel; riskIncrease: number } {
  // Calculate weighted growth impact
  const growthImpact =
    complexityGrowth * 0.4 +
    dependencyGrowth * 0.3 +
    churnGrowth * 0.3;

  // Apply growth impact over forecast period
  const riskIncrease = (growthImpact * forecastMonths) / 3; // normalize for 3 months
  const projectedScore = Math.min(100, currentRiskScore + riskIncrease);

  return {
    projectedScore: Math.round(projectedScore),
    projectedRisk: classifyRiskLevel(projectedScore),
    riskIncrease: Math.round(riskIncrease),
  };
}

/**
 * Assesses the urgency of addressing a risk
 */
export function calculateUrgency(
  currentRisk: RiskLevel,
  growthRate: number,
  daysToThreshold: number
): "IMMEDIATE" | "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  if (currentRisk === "CRITICAL" || daysToThreshold < 7) {
    return "IMMEDIATE";
  }
  if (currentRisk === "HIGH" || daysToThreshold < 14 || growthRate > 20) {
    return "URGENT";
  }
  if (currentRisk === "MEDIUM" || daysToThreshold < 30 || growthRate > 10) {
    return "HIGH";
  }
  if (growthRate > 5) {
    return "MEDIUM";
  }
  return "LOW";
}

/**
 * Detects unusual patterns that might indicate future problems
 */
export function detectWarningPatterns(
  complexityGrowth: number,
  dependencyGrowth: number,
  churnGrowth: number,
  contributorTurnover: number
): string[] {
  const warnings: string[] = [];

  if (complexityGrowth > 15) {
    warnings.push("Rapid complexity growth detected");
  }

  if (dependencyGrowth > 20) {
    warnings.push("Excessive dependency accumulation");
  }

  if (churnGrowth > 25) {
    warnings.push("Instability patterns emerging");
  }

  if (contributorTurnover > 50) {
    warnings.push("High contributor turnover risk");
  }

  if (
    complexityGrowth > 10 &&
    dependencyGrowth > 10 &&
    churnGrowth > 10
  ) {
    warnings.push("Multiple risk factors converging");
  }

  return warnings;
}
