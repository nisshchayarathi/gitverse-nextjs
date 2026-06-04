/**
 * Repository Health Calculator Utilities
 * 
 * Calculates overall repository health scores and trends
 * based on module-level metrics.
 */

import { RiskLevel, HotspotForecast } from "@/types/hotspotForecast";

/**
 * Health score weights for different factors
 */
const HEALTH_SCORE_WEIGHTS = {
  averageComplexity: 0.25,
  modulesAtRisk: 0.25,
  technicalDebt: 0.2,
  testCoverage: 0.15,
  architecturalHealth: 0.15,
};

/**
 * Calculates health score for a module
 */
export function calculateModuleHealth(forecast: HotspotForecast): number {
  const complexityScore = Math.max(0, 100 - Math.min(100, forecast.currentComplexity));
  const dependencyScore = Math.max(0, 100 - Math.min(100, forecast.dependencyCount * 2));
  const riskScore =
    {
      LOW: 100,
      MEDIUM: 70,
      HIGH: 40,
      CRITICAL: 10,
    }[forecast.forecastRisk] || 50;

  const driftScore = Math.max(0, 100 - forecast.architecturalDrift);
  const churnScore = Math.max(0, 100 - Math.min(100, forecast.churnFrequency * 10));

  return Math.round(
    (complexityScore * 0.25 +
      dependencyScore * 0.2 +
      riskScore * 0.3 +
      driftScore * 0.15 +
      churnScore * 0.1) /
      100
  );
}

/**
 * Calculates overall repository health
 */
export function calculateRepositoryHealth(forecasts: HotspotForecast[]): number {
  if (forecasts.length === 0) return 75;

  const moduleHealthScores = forecasts.map(calculateModuleHealth);
  const averageHealth = moduleHealthScores.reduce((a, b) => a + b, 0) / moduleHealthScores.length;

  // Risk distribution factor
  const riskCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  forecasts.forEach((f) => {
    riskCounts[f.forecastRisk]++;
  });

  const riskFactor = Math.max(
    0,
    100 -
      (riskCounts.CRITICAL * 20 +
        riskCounts.HIGH * 10 +
        riskCounts.MEDIUM * 3)
  );

  // Combine scores
  const repositoryHealth = Math.round((averageHealth * 60 + riskFactor * 40) / 100);

  return Math.max(0, Math.min(100, repositoryHealth));
}

/**
 * Predicts future repository health
 */
export function predictRepositoryHealth(
  currentHealth: number,
  forecasts: HotspotForecast[],
  forecastMonths: number = 3
): number {
  if (forecasts.length === 0) return currentHealth;

  // Calculate average growth rates
  const avgComplexityGrowth =
    forecasts.reduce((sum, f) => sum + f.complexityGrowthRate, 0) / forecasts.length;
  const avgDependencyGrowth =
    forecasts.reduce((sum, f) => sum + f.dependencyGrowthRate, 0) / forecasts.length;
  const avgChurnGrowth =
    forecasts.reduce((sum, f) => sum + f.sizeGrowthRate, 0) / forecasts.length;

  // Calculate health impact
  const growthImpact =
    avgComplexityGrowth * 0.4 +
    avgDependencyGrowth * 0.3 +
    avgChurnGrowth * 0.3;

  // Apply impact over forecast period
  const healthDegradation = (growthImpact * forecastMonths) / 3;
  const projectedHealth = Math.max(0, Math.min(100, currentHealth - healthDegradation));

  return Math.round(projectedHealth);
}

/**
 * Calculates technical debt ratio
 */
export function calculateTechnicalDebt(forecasts: HotspotForecast[]): number {
  if (forecasts.length === 0) return 0;

  let debtScore = 0;

  forecasts.forEach((forecast) => {
    // Weight by risk level
    const riskWeight = {
      CRITICAL: 100,
      HIGH: 60,
      MEDIUM: 30,
      LOW: 10,
    }[forecast.forecastRisk];

    // Weight by module size
    const sizeWeight = Math.min(100, (forecast.moduleSize / 1000) * 50);

    // Combined debt contribution
    debtScore += (riskWeight * 0.6 + sizeWeight * 0.4) / 100;
  });

  // Normalize to 0-100 scale
  return Math.round(Math.min(100, (debtScore / forecasts.length) * 100));
}

/**
 * Detects health trends
 */
export function detectHealthTrend(
  previousHealth: number,
  currentHealth: number,
  previousHealth30: number
): "IMPROVING" | "STABLE" | "DEGRADING" {
  const change1Month = currentHealth - previousHealth;
  const change3Month = currentHealth - previousHealth30;

  // Check if improving, degrading, or stable
  if (change1Month > 5 && change3Month > 10) {
    return "IMPROVING";
  }
  if (change1Month < -5 && change3Month < -10) {
    return "DEGRADING";
  }
  return "STABLE";
}

/**
 * Identifies at-risk modules
 */
export function identifyAtRiskModules(
  forecasts: HotspotForecast[]
): {
  modulesAtRisk: HotspotForecast[];
  criticalModules: HotspotForecast[];
  highRiskCount: number;
} {
  const criticalModules = forecasts.filter((f) => f.forecastRisk === "CRITICAL");
  const highRiskModules = forecasts.filter((f) => f.forecastRisk === "HIGH");
  const modulesAtRisk = [...criticalModules, ...highRiskModules];

  return {
    modulesAtRisk: modulesAtRisk.sort((a, b) => b.confidence - a.confidence),
    criticalModules: criticalModules.sort((a, b) => b.confidence - a.confidence),
    highRiskCount: highRiskModules.length,
  };
}

/**
 * Calculates distribution of risk levels
 */
export function calculateRiskDistribution(
  forecasts: HotspotForecast[]
): {
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const distribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  forecasts.forEach((forecast) => {
    const level = forecast.forecastRisk.toLowerCase() as keyof typeof distribution;
    distribution[level]++;
  });

  return distribution;
}

/**
 * Estimates time to critical state
 */
export function estimateTimeToCritical(
  currentHealth: number,
  healthGrowthRate: number // points per month
): number {
  if (healthGrowthRate >= 0 || currentHealth <= 20) {
    return Infinity;
  }

  // Days to reach 20 (critical threshold)
  const monthsNeeded = (20 - currentHealth) / healthGrowthRate;
  return Math.round(monthsNeeded * 30);
}

/**
 * Generates health recommendations
 */
export function generateHealthRecommendations(
  health: number,
  trend: "IMPROVING" | "STABLE" | "DEGRADING",
  modulesAtRisk: HotspotForecast[],
  technicalDebt: number
): string[] {
  const recommendations: string[] = [];

  if (health < 30) {
    recommendations.push(
      "🚨 CRITICAL: Repository health is critically low. Immediate action required."
    );
    recommendations.push("Prioritize refactoring of critical modules");
    recommendations.push("Establish code review standards");
  } else if (health < 50) {
    recommendations.push(
      "⚠️ WARNING: Repository health is below recommended threshold"
    );
    recommendations.push("Focus on reducing complexity in high-risk modules");
    recommendations.push("Implement automated testing");
  } else if (health < 70) {
    recommendations.push("Repository health is acceptable but needs improvement");
    recommendations.push("Continue monitoring module complexity growth");
  } else if (health >= 70) {
    recommendations.push("✅ Repository health is good");
    if (trend === "IMPROVING") {
      recommendations.push("Continue current maintenance practices");
    }
  }

  if (trend === "DEGRADING") {
    recommendations.push(
      "⚠️ Health is declining. Investigate root causes and increase maintenance efforts."
    );
  }

  if (modulesAtRisk.length > 5) {
    recommendations.push(
      `${modulesAtRisk.length} modules at risk. Create action plan for each.`
    );
  }

  if (technicalDebt > 60) {
    recommendations.push(
      "Technical debt is significant. Allocate time for debt reduction."
    );
  }

  return recommendations;
}

/**
 * Calculates module quality index
 */
export function calculateModuleQualityIndex(
  complexity: number,
  dependencies: number,
  testCoverage: number = 70,
  documentation: number = 70
): number {
  const complexityQuality = Math.max(0, 100 - Math.min(100, complexity));
  const dependencyQuality = Math.max(0, 100 - Math.min(100, dependencies * 2));
  const testQuality = testCoverage;
  const docQuality = documentation;

  return Math.round(
    (complexityQuality * 0.35 +
      dependencyQuality * 0.3 +
      testQuality * 0.2 +
      docQuality * 0.15) /
      100
  );
}

/**
 * Benchmarks module against repository average
 */
export function benchmarkModule(
  moduleForecast: HotspotForecast,
  allForecasts: HotspotForecast[]
): {
  complexityPercentile: number;
  dependencyPercentile: number;
  riskPercentile: number;
  healthPercentile: number;
} {
  if (allForecasts.length === 0) {
    return {
      complexityPercentile: 50,
      dependencyPercentile: 50,
      riskPercentile: 50,
      healthPercentile: 50,
    };
  }

  // Calculate percentiles
  const complexityValues = allForecasts.map((f) => f.currentComplexity).sort((a, b) => a - b);
  const dependencyValues = allForecasts.map((f) => f.dependencyCount).sort((a, b) => a - b);

  const complexityPercentile = calculatePercentile(
    complexityValues,
    moduleForecast.currentComplexity
  );
  const dependencyPercentile = calculatePercentile(
    dependencyValues,
    moduleForecast.dependencyCount
  );

  const riskScore = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  }[moduleForecast.forecastRisk];
  const riskScores = allForecasts
    .map((f) => ({ LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[f.forecastRisk]))
    .sort((a, b) => a - b);
  const riskPercentile = calculatePercentile(riskScores, riskScore);

  const healthValues = allForecasts.map(calculateModuleHealth).sort((a, b) => a - b);
  const moduleHealth = calculateModuleHealth(moduleForecast);
  const healthPercentile = calculatePercentile(healthValues, moduleHealth);

  return {
    complexityPercentile,
    dependencyPercentile,
    riskPercentile,
    healthPercentile,
  };
}

/**
 * Helper: Calculates percentile rank
 */
function calculatePercentile(sortedValues: number[], value: number): number {
  const rank = sortedValues.filter((v) => v <= value).length;
  return Math.round((rank / sortedValues.length) * 100);
}
