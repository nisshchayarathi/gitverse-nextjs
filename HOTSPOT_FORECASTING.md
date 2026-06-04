# Hotspot Forecasting Feature

## Overview

Hotspot Forecasting is a proactive maintenance risk prediction system that analyzes repository trends to forecast which modules and services are likely to become difficult to maintain in the future. It combines historical metrics analysis, trend detection, and risk modeling to provide actionable recommendations for preventing technical debt accumulation.

## Core Concepts

### 1. Historical Metrics Tracking

The system maintains historical snapshots of repository metrics to enable trend analysis:

- **Complexity Score**: Cyclomatic complexity and code structure metrics
- **Dependency Count**: Number of external dependencies for each module
- **Module Size**: Lines of code (LOC) for each module
- **Code Churn**: Frequency of changes to code files
- **Commit Activity**: Number of commits per month
- **Contributor Activity**: Number of active contributors
- **Architectural Drift**: Deviation from repository architecture patterns

### 2. Trend Analysis Engine

Analyzes repository growth trends using statistical methods:

**Key Calculations:**
- Linear regression for trend projection
- Growth rate calculation (% per month)
- Volatility analysis (standard deviation)
- Anomaly detection using z-score method
- Correlation analysis between metrics

**Example:**
```
Authentication Module

Historical Data:
- January: Complexity 52
- March: Complexity 63
- June: Complexity 74

Trend Analysis:
- Growth Rate: +15% per month
- Volatility: 4.2
- Forecast (90 days): 94
```

### 3. Risk Prediction Engine

Generates maintenance risk forecasts using weighted scoring:

**Risk Score Calculation:**
```
Risk Score = (
  Complexity × 0.25 +
  Dependencies × 0.20 +
  Churn × 0.20 +
  Architectural Drift × 0.15 +
  Module Size × 0.10 +
  Contributor Concentration × 0.10
)
```

**Risk Levels:**
- **LOW**: Score 0-40 (Stable, well-maintained)
- **MEDIUM**: Score 40-60 (Requires monitoring)
- **HIGH**: Score 60-80 (Action needed soon)
- **CRITICAL**: Score 80-100 (Immediate action required)

### 4. Confidence Scoring

Forecasts include confidence scores based on:
- Number of historical data points
- Data volatility (lower = more confidence)
- Trend strength (R² value)

```
Confidence = (Data Points × 0.4 + 
              Volatility Factor × 0.3 + 
              Trend Strength × 0.3)
```

## Architecture

### Directory Structure

```
src/
├── types/
│   └── hotspotForecast.ts          # Type definitions
├── utils/
│   ├── trendAnalyzer.ts             # Trend analysis algorithms
│   ├── riskPredictor.ts             # Risk scoring and prediction
│   ├── forecastGenerator.ts         # Recommendation generation
│   └── repositoryHealthCalculator.ts # Health score calculations
├── services/
│   └── hotspotForecastService.ts    # Service orchestration
└── components/
    └── repository/
        └── HotspotForecasting.tsx   # React UI component
```

### Key Algorithms

#### Linear Regression for Trend Analysis

```typescript
// Calculates slope, intercept, and R² value
performLinearRegression(points: { x, y }[])

// Used for forecasting future values
forecastValue(current, growthRate, monthsAhead)
```

#### Risk Indicator Generation

Generates specific risk indicators based on metric thresholds:

- High Complexity (>90 critical, >70 high)
- High Dependency Count (>50 critical, >30 high)
- High Code Churn (>80% critical)
- Architectural Drift (>80 score)
- Large Module (>2000 LOC)
- Contributor Concentration

#### Recommendation Engine

Generates prioritized recommendations based on:
- Risk level and indicators
- Growth rates
- Implementation effort
- Expected impact

## Type Definitions

### HotspotForecast

Main forecast for a single module:

```typescript
interface HotspotForecast {
  id: string;
  moduleId: string;
  moduleName: string;
  currentComplexity: number;
  complexityGrowthRate: number;
  dependencyCount: number;
  dependencyGrowthRate: number;
  moduleSize: number;
  churnFrequency: number;
  forecastRisk: RiskLevel;
  confidence: number; // 0-100
  projectedComplexity: number;
  projectedRisk: RiskLevel;
  riskIndicators: RiskIndicator[];
  recommendations: ForecastRecommendation[];
}
```

### RepositoryForecast

Repository-wide forecast summary:

```typescript
interface RepositoryForecast {
  repositoryHealthScore: number; // 0-100
  projectedHealthScore: number; // 90-day projection
  healthTrend: "IMPROVING" | "STABLE" | "DEGRADING";
  modulesAtRisk: number;
  criticalModules: number;
  technicalDebtTrend: string;
  hotspotForecasts: HotspotForecast[];
  topRecommendations: ForecastRecommendation[];
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
```

### ForecastRecommendation

Actionable recommendation for addressing risks:

```typescript
interface ForecastRecommendation {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "REFACTOR" | "SPLIT_MODULE" | "REDUCE_COUPLING" | ...;
  effort: "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE" | "VERY_LARGE";
  expectedImpact: number; // 0-100
  implementationSteps: string[];
  estimatedTimeToImplement: string;
  riskOfChange: "LOW" | "MEDIUM" | "HIGH";
}
```

## Service API

### HotspotForecastService

#### generateModuleForecast()

Generates forecast for a single module.

```typescript
static generateModuleForecast(
  moduleId: string,
  moduleName: string,
  historicalMetrics: HistoricalMetrics[],
  totalContributors: number = 1,
  config?: ForecastConfig
): HotspotForecast | null
```

**Parameters:**
- `moduleId`: Unique module identifier
- `moduleName`: Human-readable module name
- `historicalMetrics`: Array of historical metric snapshots
- `totalContributors`: Total contributors in repository
- `config`: Forecast configuration (optional)

**Returns:** HotspotForecast object or null if insufficient data

#### generateRepositoryForecast()

Generates repository-wide forecast.

```typescript
static generateRepositoryForecast(
  repositoryId: string,
  moduleForecasts: HotspotForecast[],
  historicalHealth?: { health: number; date: Date }[],
  config?: ForecastConfig
): RepositoryForecast
```

#### generateHealthTimeline()

Generates health score timeline data for visualization.

```typescript
static generateHealthTimeline(
  forecasts: HotspotForecast[],
  forecastMonths: number = 3
): HealthDataPoint[]
```

#### generateComplexityTimeline()

Generates complexity projection data.

```typescript
static generateComplexityTimeline(
  forecasts: HotspotForecast[],
  forecastMonths: number = 3
): ComplexityDataPoint[]
```

## Configuration

### Default Forecast Configuration

```typescript
const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  minDataPoints: 3,           // Minimum historical data points
  forecastWindow: 90,         // 90-day forecast
  complexityThresholds: {
    critical: 90,
    high: 70,
    medium: 50
  },
  growthRateThresholds: {
    complexity: 15,           // % per month
    dependencies: 20,
    churn: 25
  },
  confidenceThreshold: 50,    // Minimum confidence to include
  useAIRecommendations: true
};
```

## Usage Examples

### Basic Usage

```typescript
import { HotspotForecastService } from "@/services/hotspotForecastService";
import { HotspotForecasting } from "@/components/repository/HotspotForecasting";

// Generate forecasts
const moduleForecasts = modules.map(module =>
  HotspotForecastService.generateModuleForecast(
    module.id,
    module.name,
    module.historicalMetrics
  )
).filter(f => f !== null);

const repositoryForecast = HotspotForecastService.generateRepositoryForecast(
  repositoryId,
  moduleForecasts
);

// Render component
<HotspotForecasting 
  forecast={repositoryForecast}
  onModuleSelect={(moduleId) => console.log("Selected:", moduleId)}
/>
```

### Advanced: Custom Configuration

```typescript
import { DEFAULT_FORECAST_CONFIG } from "@/services/hotspotForecastService";

const customConfig = {
  ...DEFAULT_FORECAST_CONFIG,
  forecastWindow: 180,        // 6-month forecast
  complexityThresholds: {
    critical: 100,
    high: 80,
    medium: 60
  },
  confidenceThreshold: 70     // Higher confidence threshold
};

const forecast = HotspotForecastService.generateModuleForecast(
  moduleId,
  moduleName,
  historicalMetrics,
  totalContributors,
  customConfig
);
```

### Integration with Repository Overview

```typescript
import { HotspotForecasting } from "@/components/repository/HotspotForecasting";

export function RepositoryOverview() {
  const [forecast, setForecast] = useState<RepositoryForecast | null>(null);

  useEffect(() => {
    // Generate forecast on component mount
    const forecasts = // ... generate module forecasts
    setForecast(HotspotForecastService.generateRepositoryForecast(
      repoId,
      forecasts
    ));
  }, [repoId]);

  return (
    <>
      {/* Other components... */}
      {forecast && (
        <HotspotForecasting 
          forecast={forecast}
          onModuleSelect={handleModuleSelect}
        />
      )}
    </>
  );
}
```

## React Component Props

### HotspotForecasting Component

```typescript
interface HotspotForecastingProps {
  forecast: RepositoryForecast;           // Required
  onModuleSelect?: (moduleId: string) => void;
  isLoading?: boolean;                    // Loading state
  error?: string | null;                  // Error message
}
```

## Features

### 1. Repository Health Dashboard

Displays overall repository health and trends:
- Current health score (0-100)
- 90-day projected health
- Health trend (improving/stable/degrading)
- Technical debt status

### 2. Risk Distribution

Visual representation of module risk distribution:
- Count and percentage of critical modules
- Count and percentage of high-risk modules
- Medium and low-risk module counts

### 3. Module Forecasts

Detailed forecast cards for each module showing:
- Module name and ID
- Current complexity and growth rate
- Current dependencies and growth rate
- Module size and code churn
- Risk indicators
- Forecast confidence
- Projected risk level

### 4. Recommendations

Actionable recommendations grouped by:
- Priority (Critical → Low)
- Category (Refactor, Split, Reduce Coupling, etc.)
- Effort estimation (Trivial → Very Large)
- Expected impact percentage
- Implementation steps
- Risk of change

### 5. Filtering and Search

- Filter by risk level (Critical, High, Medium, Low, All)
- Search modules by name or ID
- Real-time result count updates

### 6. Timeline Visualization

Historical and projected data for:
- Repository health progression
- Module complexity trends
- Risk distribution over time

## Utility Functions

### Trend Analyzer

```typescript
analyzeTrend(moduleName, moduleId, metric, dataPoints)
  → TrendAnalysis

calculateGrowthRate(current, previous, monthsElapsed)
  → number

calculateVolatility(values)
  → number

forecastValue(current, growthRate, monthsAhead)
  → number

performLinearRegression(points)
  → { slope, intercept, r2 }

generateTrendVisualizationData(moduleName, metric, data, forecastMonths)
  → TrendVisualizationData

detectAnomalies(values, threshold)
  → number[] (indices)

calculateCorrelation(series1, series2)
  → number (-1 to 1)
```

### Risk Predictor

```typescript
calculateRiskScore(complexity, dependencies, churn, drift, size, concentration)
  → number (0-100)

classifyRiskLevel(score)
  → RiskLevel

generateRiskIndicators(complexity, dependencies, churn, drift, size, ...)
  → RiskIndicator[]

calculateConfidenceScore(dataPoints, volatility, trendStrength)
  → number (0-100)

predictFutureRisk(current, complexityGrowth, dependencyGrowth, churnGrowth, months)
  → { projectedScore, projectedRisk, riskIncrease }

detectWarningPatterns(complexityGrowth, dependencyGrowth, churnGrowth, turnover)
  → string[] (warning messages)
```

### Forecast Generator

```typescript
generateRecommendations(riskLevel, riskIndicators, growthRates)
  → ForecastRecommendation[]

prioritizeRecommendations(recommendations)
  → ForecastRecommendation[] (sorted by priority/effort)

estimateImplementationEffort(complexity, dependencies, size)
  → EffortLevel

analyzeRecommendationImpact(recommendation, currentMetrics)
  → ImpactAnalysis

estimateDaysToThreshold(current, growthRate, threshold)
  → number
```

### Repository Health Calculator

```typescript
calculateRepositoryHealth(forecasts)
  → number (0-100)

calculateModuleHealth(forecast)
  → number (0-100)

calculateTechnicalDebt(forecasts)
  → number (0-100)

predictRepositoryHealth(currentHealth, forecasts, forecastMonths)
  → number

identifyAtRiskModules(forecasts)
  → { modulesAtRisk, criticalModules, highRiskCount }

calculateRiskDistribution(forecasts)
  → { critical, high, medium, low }

benchmarkModule(moduleForecast, allForecasts)
  → { complexityPercentile, dependencyPercentile, ... }
```

## Example Output

### Repository Health Summary

```
Current Health: 72/100
Projected Health (90d): 64/100
Trend: DEGRADING

Modules at Risk: 6/18
Critical Modules: 2
Technical Debt: INCREASING

Risk Distribution:
- Critical: 2 (11%)
- High: 4 (22%)
- Medium: 7 (39%)
- Low: 5 (28%)
```

### Module Forecast

```
Authentication Service

Current Metrics:
- Complexity: 74 (+15% per month)
- Dependencies: 28 (+8% per month)
- Size: 1,847 LOC
- Churn: 6.2 changes/month
- Contributors: 2

Risk Indicators:
- High Complexity
- High Dependency Count
- Architectural Drift

Risk Level: HIGH
Confidence: 87%

Projected Risk (90d): CRITICAL
Projected Complexity: 94

Recommendations:
1. [CRITICAL] Refactor Complex Functions
   - Effort: MEDIUM
   - Impact: 20%
   - Time: 3-7 days

2. [HIGH] Reduce Dependency Coupling
   - Effort: MEDIUM
   - Impact: 25%
   - Time: 2-4 weeks

3. [HIGH] Improve Test Coverage
   - Effort: MEDIUM
   - Impact: 15%
   - Time: 2-3 weeks
```

## Best Practices

### 1. Data Quality

- Ensure at least 3-4 historical data points per module
- Collect metrics consistently at regular intervals (e.g., weekly)
- Validate data for outliers and anomalies

### 2. Interpretation

- Consider confidence scores when prioritizing actions
- Multiple risk indicators increase reliability
- Monitor trends over multiple forecast cycles

### 3. Action Planning

- Address CRITICAL risks immediately
- Create timeline for HIGH risk modules
- Use recommendations as starting point, not absolute directive
- Monitor effectiveness of implemented changes

### 4. Integration

- Run forecasts regularly (weekly/biweekly)
- Include forecast review in code review process
- Share forecasts with team leads and architects
- Track forecast accuracy over time

## Performance Considerations

- Trend analysis is O(n) where n = number of historical data points
- Linear regression is O(n)
- Risk calculation is O(1) per module
- Recommendation generation is O(risk_indicators)

### Optimization Tips

- Batch forecast generation for multiple modules
- Cache historical metrics locally
- Use pagination for large module lists
- Implement incremental forecast updates

## Future Enhancements

- AI-powered recommendations using ML models
- Contributor expertise analysis
- Dependency graph visualization
- Historical forecast accuracy tracking
- Automated alert system
- Custom threshold configuration per team
- Integration with CI/CD pipelines
- Release risk forecasting
- Team capacity modeling

## Troubleshooting

### Issue: Low Confidence Scores

**Cause:** Insufficient historical data or high volatility

**Solution:**
- Collect more historical data points
- Increase `minDataPoints` configuration
- Check data quality for anomalies
- Consider smoothing data with moving averages

### Issue: Unexpected Risk Scores

**Cause:** Misconfigured thresholds or weighted factors

**Solution:**
- Review RISK_WEIGHTS in riskPredictor.ts
- Adjust `complexityThresholds` in config
- Verify metric calculations
- Compare against manual assessment

### Issue: No Recommendations Generated

**Cause:** Risk indicators don't match templates

**Solution:**
- Verify risk indicators are generated
- Check recommendation templates in forecastGenerator.ts
- Ensure growth rates exceed thresholds
- Add custom templates if needed

## References

- **Linear Regression**: Statistical method for trend projection
- **Cyclomatic Complexity**: Quantitative measure of code structure
- **Technical Debt**: Concept coined by Ward Cunningham
- **Code Churn**: Frequency of code changes (indicator of instability)
- **Architectural Drift**: Deviation from intended architecture

## Contributing

To extend the forecasting capabilities:

1. Add new metrics to `HistoricalMetrics` type
2. Create analysis function in `trendAnalyzer.ts`
3. Update risk calculation in `riskPredictor.ts`
4. Add recommendation templates in `forecastGenerator.ts`
5. Update UI in `HotspotForecasting.tsx`

## License

Part of GitVerse project. See main repository for license details.
