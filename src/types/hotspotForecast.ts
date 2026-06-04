/**
 * Hotspot Forecasting Type Definitions
 * 
 * Defines types for repository maintenance risk forecasting,
 * trend analysis, and proactive recommendation generation.
 */

/**
 * Risk level classification for forecasted hotspots
 */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Time window for forecasts
 */
export type ForecastWindow = 30 | 60 | 90 | 180;

/**
 * Metric type for historical tracking
 */
export type MetricType = 
  | "complexity"
  | "dependencies"
  | "size"
  | "churn"
  | "commits"
  | "contributors"
  | "drift";

/**
 * Historical metric data point
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  moduleId?: string;
  moduleName?: string;
}

/**
 * Historical metrics snapshot
 */
export interface HistoricalMetrics {
  id: string;
  repositoryId: string;
  moduleId: string;
  moduleName: string;
  timestamp: Date;
  complexity: number;
  dependencies: number;
  size: number; // lines of code
  churnFrequency: number; // changes per month
  commitActivity: number; // commits per month
  contributorCount: number;
  architecturalDrift: number; // score 0-100
  createdAt: Date;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  moduleName: string;
  moduleId: string;
  metric: MetricType;
  currentValue: number;
  growthRate: number; // percentage per month
  trend: "INCREASING" | "DECREASING" | "STABLE";
  volatility: number; // standard deviation
  dataPoints: number; // number of historical points
  forecastedValue30Days: number;
  forecastedValue60Days: number;
  forecastedValue90Days: number;
}

/**
 * Risk indicator for forecasted maintenance
 */
export interface RiskIndicator {
  name: string;
  currentValue: number;
  threshold: number;
  severity: RiskLevel;
  impact: string;
}

/**
 * Hotspot forecast prediction
 */
export interface HotspotForecast {
  id: string;
  repositoryId: string;
  moduleId: string;
  moduleName: string;
  currentComplexity: number;
  complexityGrowthRate: number; // % per month
  dependencyCount: number;
  dependencyGrowthRate: number;
  moduleSize: number;
  sizeGrowthRate: number;
  churnFrequency: number;
  commitActivity: number;
  contributorCount: number;
  architecturalDrift: number;
  forecastRisk: RiskLevel;
  confidence: number; // 0-100
  forecastWindow: ForecastWindow;
  projectedComplexity: number;
  projectedDependencies: number;
  projectedRisk: RiskLevel;
  riskIndicators: RiskIndicator[];
  recommendations: ForecastRecommendation[];
  generatedAt: Date;
  updatedAt: Date;
}

/**
 * Recommendation for addressing forecasted risks
 */
export interface ForecastRecommendation {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: 
    | "REFACTOR"
    | "SPLIT_MODULE"
    | "REDUCE_COUPLING"
    | "TEST_COVERAGE"
    | "ARCHITECTURE"
    | "DEPENDENCY_MANAGEMENT"
    | "CODE_CLEANUP";
  effort: "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE" | "VERY_LARGE";
  expectedImpact: number; // 0-100, improvement potential
  implementationSteps: string[];
  estimatedTimeToImplement: string;
  riskOfChange: "LOW" | "MEDIUM" | "HIGH";
  relatedRisks: string[];
}

/**
 * Repository-wide forecast summary
 */
export interface RepositoryForecast {
  id: string;
  repositoryId: string;
  generatedAt: Date;
  forecastWindow: ForecastWindow;
  repositoryHealthScore: number; // 0-100
  projectedHealthScore: number; // 0-100
  healthTrend: "IMPROVING" | "STABLE" | "DEGRADING";
  modulesAtRisk: number;
  criticalModules: number;
  highRiskModules: number;
  technicalDebtTrend: "INCREASING" | "STABLE" | "DECREASING";
  averageComplexityGrowth: number; // % per month
  averageDependencyGrowth: number;
  averageChurn: number;
  hotspotForecasts: HotspotForecast[];
  topRecommendations: ForecastRecommendation[];
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  forecastAccuracy?: number; // 0-100, based on past predictions
}

/**
 * Forecast report with detailed analysis
 */
export interface ForecastReport {
  repositoryForecast: RepositoryForecast;
  summary: ReportSummary;
  healthTimeline: HealthDataPoint[];
  complexityTimeline: ComplexityDataPoint[];
  insights: ForecastInsight[];
}

/**
 * Report summary
 */
export interface ReportSummary {
  title: string;
  description: string;
  keyFindings: string[];
  generatedAt: Date;
  dataQuality: number; // 0-100
  confidenceLevel: number; // 0-100
}

/**
 * Health score data point for timeline visualization
 */
export interface HealthDataPoint {
  date: Date;
  healthScore: number;
  moduleCount: number;
  atRiskCount: number;
}

/**
 * Complexity data point for timeline visualization
 */
export interface ComplexityDataPoint {
  date: Date;
  averageComplexity: number;
  maxComplexity: number;
  minComplexity: number;
  moduleName?: string;
}

/**
 * Insight from forecast analysis
 */
export interface ForecastInsight {
  type: "RISK" | "OPPORTUNITY" | "TREND" | "WARNING" | "SUCCESS";
  title: string;
  description: string;
  relatedModules: string[];
  actionItems?: string[];
  severity?: RiskLevel;
}

/**
 * Configuration for forecast generation
 */
export interface ForecastConfig {
  minDataPoints: number; // minimum historical points for trend analysis
  forecastWindow: ForecastWindow;
  complexityThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  growthRateThresholds: {
    complexity: number;
    dependencies: number;
    churn: number;
  };
  confidenceThreshold: number; // 0-100
  useAIRecommendations: boolean;
}

/**
 * Trend visualization data
 */
export interface TrendVisualizationData {
  moduleName: string;
  metric: MetricType;
  historicalData: Array<{
    date: Date;
    value: number;
  }>;
  forecastedData: Array<{
    date: Date;
    value: number;
    confidence: number;
  }>;
  trendLine: {
    slope: number;
    intercept: number;
  };
}

/**
 * Module comparison for trend analysis
 */
export interface ModuleComparison {
  moduleA: {
    id: string;
    name: string;
    metrics: HistoricalMetrics;
  };
  moduleB: {
    id: string;
    name: string;
    metrics: HistoricalMetrics;
  };
  similarityScore: number; // 0-100
  divergenceRate: number; // how fast they're diverging
  prediction: string;
}
