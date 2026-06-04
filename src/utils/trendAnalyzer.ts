/**
 * Trend Analysis Utilities
 * 
 * Analyzes repository trends over time using statistical methods,
 * calculates growth rates, and forecasts future values.
 */

import {
  TrendAnalysis,
  MetricDataPoint,
  MetricType,
  HistoricalMetrics,
  TrendVisualizationData,
} from "@/types/hotspotForecast";

/**
 * Simple linear regression for trend analysis
 */
interface LinearRegression {
  slope: number;
  intercept: number;
  r2: number; // coefficient of determination
}

/**
 * Performs linear regression on data points
 */
export function performLinearRegression(
  points: Array<{ x: number; y: number }>
): LinearRegression {
  if (points.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce(
    (sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2),
    0
  );
  const r2 = 1 - ssResidual / ssTotal;

  return { slope, intercept, r2: Math.max(0, r2) };
}

/**
 * Calculates growth rate as percentage per month
 */
export function calculateGrowthRate(
  currentValue: number,
  previousValue: number,
  monthsElapsed: number
): number {
  if (previousValue === 0 || monthsElapsed === 0) return 0;

  const percentageChange = ((currentValue - previousValue) / previousValue) * 100;
  return percentageChange / monthsElapsed;
}

/**
 * Calculates volatility (standard deviation) of values
 */
export function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Forecasts future values using linear regression
 */
export function forecastValue(
  currentValue: number,
  growthRate: number,
  monthsAhead: number
): number {
  // Simple exponential-like growth model
  return currentValue * Math.pow(1 + growthRate / 100, monthsAhead / 1);
}

/**
 * Calculates trend direction based on recent changes
 */
export function calculateTrendDirection(
  recent: number[],
  previous: number[]
): "INCREASING" | "DECREASING" | "STABLE" {
  if (recent.length === 0 || previous.length === 0) {
    return "STABLE";
  }

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  if (change > 5) return "INCREASING";
  if (change < -5) return "DECREASING";
  return "STABLE";
}

/**
 * Analyzes trend from historical data points
 */
export function analyzeTrend(
  moduleName: string,
  moduleId: string,
  metric: MetricType,
  dataPoints: MetricDataPoint[]
): TrendAnalysis {
  if (dataPoints.length < 2) {
    return {
      moduleName,
      moduleId,
      metric,
      currentValue: dataPoints[0]?.value || 0,
      growthRate: 0,
      trend: "STABLE",
      volatility: 0,
      dataPoints: dataPoints.length,
      forecastedValue30Days: dataPoints[0]?.value || 0,
      forecastedValue60Days: dataPoints[0]?.value || 0,
      forecastedValue90Days: dataPoints[0]?.value || 0,
    };
  }

  // Sort by timestamp
  const sorted = [...dataPoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const values = sorted.map((p) => p.value);
  const current = values[values.length - 1];
  const previous = values[0];

  // Calculate time span in months
  const timeSpanDays =
    (sorted[sorted.length - 1].timestamp.getTime() -
      sorted[0].timestamp.getTime()) /
    (1000 * 60 * 60 * 24);
  const timeSpanMonths = timeSpanDays / 30;

  const growthRate = calculateGrowthRate(current, previous, timeSpanMonths);
  const volatility = calculateVolatility(values);

  // Recent vs previous trend
  const midpoint = Math.floor(values.length / 2);
  const recentValues = values.slice(midpoint);
  const previousValues = values.slice(0, midpoint);
  const trend = calculateTrendDirection(recentValues, previousValues);

  return {
    moduleName,
    moduleId,
    metric,
    currentValue: current,
    growthRate,
    trend,
    volatility,
    dataPoints: dataPoints.length,
    forecastedValue30Days: forecastValue(current, growthRate, 1),
    forecastedValue60Days: forecastValue(current, growthRate, 2),
    forecastedValue90Days: forecastValue(current, growthRate, 3),
  };
}

/**
 * Generates visualization data for trend charts
 */
export function generateTrendVisualizationData(
  moduleName: string,
  metric: MetricType,
  historicalData: Array<{ date: Date; value: number }>,
  forecastMonths: number = 3
): TrendVisualizationData {
  if (historicalData.length < 2) {
    return {
      moduleName,
      metric,
      historicalData,
      forecastedData: [],
      trendLine: { slope: 0, intercept: 0 },
    };
  }

  // Prepare data for linear regression
  const sortedData = [...historicalData].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const startDate = sortedData[0].date;
  const points = sortedData.map((d) => ({
    x: (d.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    y: d.value,
  }));

  const regression = performLinearRegression(points);

  // Generate forecast points
  const lastDate = sortedData[sortedData.length - 1].date;
  const forecastedData = [];

  for (let i = 1; i <= forecastMonths; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setMonth(futureDate.getMonth() + i);

    const daysFromStart =
      (futureDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const predictedValue = regression.slope * daysFromStart + regression.intercept;

    forecastedData.push({
      date: futureDate,
      value: Math.max(0, predictedValue),
      confidence: Math.max(50, Math.min(100, regression.r2 * 100 - i * 5)),
    });
  }

  return {
    moduleName,
    metric,
    historicalData: sortedData,
    forecastedData,
    trendLine: {
      slope: regression.slope,
      intercept: regression.intercept,
    },
  };
}

/**
 * Detects anomalies in trend data
 */
export function detectAnomalies(
  values: number[],
  threshold: number = 2 // standard deviations
): number[] {
  if (values.length < 3) return [];

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = calculateVolatility(values);

  return values
    .map((v, i) => ({
      index: i,
      value: v,
      zScore: Math.abs((v - mean) / stdDev),
    }))
    .filter((point) => point.zScore > threshold)
    .map((point) => point.index);
}

/**
 * Calculates correlation between two metrics
 */
export function calculateCorrelation(series1: number[], series2: number[]): number {
  if (series1.length !== series2.length || series1.length < 2) return 0;

  const mean1 = series1.reduce((a, b) => a + b, 0) / series1.length;
  const mean2 = series2.reduce((a, b) => a + b, 0) / series2.length;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < series1.length; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;

    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Smooths time series data using moving average
 */
export function smoothTimeSeries(values: number[], windowSize: number = 3): number[] {
  if (values.length < windowSize) return values;

  const smoothed = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(values.length, start + windowSize);
    const window = values.slice(start, end);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    smoothed.push(avg);
  }

  return smoothed;
}
