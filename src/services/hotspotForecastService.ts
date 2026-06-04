/**
 * Hotspot Forecasting Service
 * 
 * Orchestrates forecast generation combining trend analysis,
 * risk prediction, and recommendation generation.
 */

import {
  HotspotForecast,
  RepositoryForecast,
  HistoricalMetrics,
  MetricDataPoint,
  ForecastConfig,
  ForecastWindow,
  RiskLevel,
  HealthDataPoint,
  ComplexityDataPoint,
} from "@/types/hotspotForecast";
import { analyzeTrend } from "@/utils/trendAnalyzer";
import {
  calculateRiskScore,
  classifyRiskLevel,
  generateRiskIndicators,
  calculateConfidenceScore,
  predictFutureRisk,
  detectWarningPatterns,
} from "@/utils/riskPredictor";
import {
  generateRecommendations,
  prioritizeRecommendations,
  estimateDaysToThreshold,
} from "@/utils/forecastGenerator";
import {
  calculateRepositoryHealth,
  predictRepositoryHealth,
  calculateTechnicalDebt,
  detectHealthTrend,
  identifyAtRiskModules,
  calculateRiskDistribution,
  estimateTimeToCritical,
} from "@/utils/repositoryHealthCalculator";

/**
 * Default forecast configuration
 */
export const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  minDataPoints: 3,
  forecastWindow: 90,
  complexityThresholds: {
    critical: 90,
    high: 70,
    medium: 50,
  },
  growthRateThresholds: {
    complexity: 15,
    dependencies: 20,
    churn: 25,
  },
  confidenceThreshold: 50,
  useAIRecommendations: true,
};

export class HotspotForecastService {
  /**
   * Generates forecast for a specific module
   */
  static generateModuleForecast(
    moduleId: string,
    moduleName: string,
    historicalMetrics: HistoricalMetrics[],
    totalContributors: number = 1,
    config: ForecastConfig = DEFAULT_FORECAST_CONFIG
  ): HotspotForecast | null {
    if (historicalMetrics.length < config.minDataPoints) {
      return null;
    }

    // Get latest metrics
    const latest = historicalMetrics[historicalMetrics.length - 1];

    // Prepare data points for trend analysis
    const complexityPoints: MetricDataPoint[] = historicalMetrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.complexity,
    }));

    const dependencyPoints: MetricDataPoint[] = historicalMetrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.dependencies,
    }));

    const churnPoints: MetricDataPoint[] = historicalMetrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.churnFrequency,
    }));

    // Analyze trends
    const complexityTrend = analyzeTrend(
      moduleName,
      moduleId,
      "complexity",
      complexityPoints
    );
    const dependencyTrend = analyzeTrend(
      moduleName,
      moduleId,
      "dependencies",
      dependencyPoints
    );
    const churnTrend = analyzeTrend(
      moduleName,
      moduleId,
      "churn",
      churnPoints
    );

    // Calculate risk score
    const contributorConcentration =
      latest.contributorCount === 1 ? 100 : Math.max(0, 100 - latest.contributorCount * 10);

    const riskScore = calculateRiskScore(
      latest.complexity,
      latest.dependencies,
      latest.churnFrequency,
      latest.architecturalDrift,
      latest.size,
      contributorConcentration
    );

    const forecastRisk = classifyRiskLevel(riskScore);

    // Generate risk indicators
    const riskIndicators = generateRiskIndicators(
      latest.complexity,
      latest.dependencies,
      latest.churnFrequency,
      latest.architecturalDrift,
      latest.size,
      latest.commitActivity,
      latest.contributorCount,
      totalContributors
    );

    // Predict future risk
    const futureRiskPrediction = predictFutureRisk(
      riskScore,
      complexityTrend.growthRate,
      dependencyTrend.growthRate,
      churnTrend.growthRate,
      config.forecastWindow / 30
    );

    // Calculate confidence
    const confidence = calculateConfidenceScore(
      historicalMetrics.length,
      complexityTrend.volatility,
      0.7 // assume moderate trend strength
    );

    // Filter by confidence threshold
    if (confidence < config.confidenceThreshold) {
      return null;
    }

    // Generate recommendations
    const recommendations = generateRecommendations(
      forecastRisk,
      riskIndicators,
      {
        complexity: complexityTrend.growthRate,
        dependencies: dependencyTrend.growthRate,
        churn: churnTrend.growthRate,
      }
    );

    // Calculate days to threshold
    const daysToThreshold = estimateDaysToThreshold(
      latest.complexity,
      complexityTrend.growthRate,
      config.complexityThresholds.critical
    );

    return {
      id: `forecast-${moduleId}-${Date.now()}`,
      repositoryId: "", // Will be set by caller
      moduleId,
      moduleName,
      currentComplexity: latest.complexity,
      complexityGrowthRate: complexityTrend.growthRate,
      dependencyCount: latest.dependencies,
      dependencyGrowthRate: dependencyTrend.growthRate,
      moduleSize: latest.size,
      sizeGrowthRate: 0, // Would need additional tracking
      churnFrequency: latest.churnFrequency,
      commitActivity: latest.commitActivity,
      contributorCount: latest.contributorCount,
      architecturalDrift: latest.architecturalDrift,
      forecastRisk,
      confidence,
      forecastWindow: config.forecastWindow as ForecastWindow,
      projectedComplexity: complexityTrend.forecastedValue90Days,
      projectedDependencies: dependencyTrend.forecastedValue90Days,
      projectedRisk: futureRiskPrediction.projectedRisk,
      riskIndicators,
      recommendations: prioritizeRecommendations(recommendations),
      generatedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generates repository-wide forecast
   */
  static generateRepositoryForecast(
    repositoryId: string,
    moduleForecasts: HotspotForecast[],
    historicalHealth: { health: number; date: Date }[] = [],
    config: ForecastConfig = DEFAULT_FORECAST_CONFIG
  ): RepositoryForecast {
    // Calculate health scores
    const currentHealth = calculateRepositoryHealth(moduleForecasts);
    const projectedHealth = predictRepositoryHealth(
      currentHealth,
      moduleForecasts,
      config.forecastWindow / 30
    );

    // Identify at-risk modules
    const { modulesAtRisk, criticalModules, highRiskCount } =
      identifyAtRiskModules(moduleForecasts);

    // Detect health trend
    const previousHealth30 =
      historicalHealth.length > 0 ? historicalHealth[0].health : currentHealth;
    const healthTrend = detectHealthTrend(currentHealth, currentHealth, previousHealth30);

    // Calculate average growth rates
    const avgComplexityGrowth =
      moduleForecasts.reduce((sum, f) => sum + f.complexityGrowthRate, 0) /
      Math.max(1, moduleForecasts.length);
    const avgDependencyGrowth =
      moduleForecasts.reduce((sum, f) => sum + f.dependencyGrowthRate, 0) /
      Math.max(1, moduleForecasts.length);

    // Calculate technical debt
    const technicalDebt = calculateTechnicalDebt(moduleForecasts);
    const technicalDebtTrend =
      avgComplexityGrowth > 5 || avgDependencyGrowth > 5
        ? "INCREASING"
        : avgComplexityGrowth < -5
          ? "DECREASING"
          : "STABLE";

    // Calculate average churn
    const averageChurn =
      moduleForecasts.reduce((sum, f) => sum + f.churnFrequency, 0) /
      Math.max(1, moduleForecasts.length);

    // Generate top recommendations
    const allRecommendations = moduleForecasts.flatMap((f) => f.recommendations);
    const topRecommendations = prioritizeRecommendations(
      allRecommendations.slice(0, 15)
    ).slice(0, 5);

    // Calculate risk distribution
    const riskDistribution = calculateRiskDistribution(moduleForecasts);

    return {
      id: `repo-forecast-${repositoryId}-${Date.now()}`,
      repositoryId,
      generatedAt: new Date(),
      forecastWindow: config.forecastWindow as ForecastWindow,
      repositoryHealthScore: currentHealth,
      projectedHealthScore: projectedHealth,
      healthTrend,
      modulesAtRisk: modulesAtRisk.length,
      criticalModules: criticalModules.length,
      highRiskModules: highRiskCount,
      technicalDebtTrend,
      averageComplexityGrowth: avgComplexityGrowth,
      averageDependencyGrowth: avgDependencyGrowth,
      averageChurn,
      hotspotForecasts: moduleForecasts,
      topRecommendations,
      riskDistribution,
    };
  }

  /**
   * Generates health timeline data
   */
  static generateHealthTimeline(
    forecasts: HotspotForecast[],
    forecastMonths: number = 3
  ): HealthDataPoint[] {
    const timeline: HealthDataPoint[] = [];
    const today = new Date();

    // Generate monthly data points
    for (let i = 0; i <= forecastMonths; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() + i);

      // Simulate health progression
      const monthProgress = i / forecastMonths;
      const healthPoints = forecasts.map((f) => {
        const riskWeight = {
          LOW: 0.1,
          MEDIUM: 0.3,
          HIGH: 0.6,
          CRITICAL: 1.0,
        }[f.forecastRisk];

        return 100 - riskWeight * monthProgress * 20;
      });

      const avgHealth =
        healthPoints.reduce((a, b) => a + b, 0) / Math.max(1, healthPoints.length);

      const atRiskCount = forecasts.filter((f) =>
        ["HIGH", "CRITICAL"].includes(f.forecastRisk)
      ).length;

      timeline.push({
        date,
        healthScore: Math.round(Math.max(0, Math.min(100, avgHealth))),
        moduleCount: forecasts.length,
        atRiskCount,
      });
    }

    return timeline;
  }

  /**
   * Generates complexity timeline data
   */
  static generateComplexityTimeline(
    forecasts: HotspotForecast[],
    forecastMonths: number = 3
  ): ComplexityDataPoint[] {
    const timeline: ComplexityDataPoint[] = [];
    const today = new Date();

    for (let i = 0; i <= forecastMonths; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() + i);

      // Project complexity values
      const projectedComplexities = forecasts.map((f) => {
        const monthsAhead = i;
        const projectedValue =
          f.currentComplexity *
          Math.pow(1 + f.complexityGrowthRate / 100, monthsAhead / 1);
        return projectedValue;
      });

      timeline.push({
        date,
        averageComplexity:
          projectedComplexities.reduce((a, b) => a + b, 0) / Math.max(1, projectedComplexities.length),
        maxComplexity: Math.max(...projectedComplexities),
        minComplexity: Math.min(...projectedComplexities),
      });
    }

    return timeline;
  }

  /**
   * Calculates forecast accuracy based on past predictions
   */
  static calculateForecastAccuracy(
    predictions: { predicted: number; actual: number }[]
  ): number {
    if (predictions.length === 0) return 0;

    const errors = predictions.map((p) => Math.abs(p.predicted - p.actual));
    const mape = (errors.reduce((a, b) => a + b, 0) / predictions.length) * 100;

    // Convert MAPE to accuracy (100% accuracy = 0% MAPE)
    return Math.max(0, 100 - mape);
  }
}
