"use client";

/**
 * Hotspot Forecasting Component
 * 
 * Displays repository maintenance risk forecasts, module-level predictions,
 * and actionable recommendations for reducing technical debt.
 */

import React, { useState, useMemo } from "react";
import {
  HotspotForecast,
  RepositoryForecast,
  ForecastRecommendation,
  RiskLevel,
} from "@/types/hotspotForecast";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Zap,
  BarChart3,
  Target,
  Clock,
  Users,
  Settings,
} from "lucide-react";

interface HotspotForecastingProps {
  forecast: RepositoryForecast;
  onModuleSelect?: (moduleId: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Risk level color mapping
 */
const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "bg-green-50 border-green-200 text-green-900",
  MEDIUM: "bg-yellow-50 border-yellow-200 text-yellow-900",
  HIGH: "bg-orange-50 border-orange-200 text-orange-900",
  CRITICAL: "bg-red-50 border-red-200 text-red-900",
};

const RISK_BADGE_COLORS: Record<RiskLevel, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  LOW: <CheckCircle className="w-4 h-4" />,
  MEDIUM: <AlertCircle className="w-4 h-4" />,
  HIGH: <AlertTriangle className="w-4 h-4" />,
  CRITICAL: <AlertTriangle className="w-4 h-4" />,
};

/**
 * Repository Health Summary Component
 */
function HealthSummary({ forecast }: { forecast: RepositoryForecast }) {
  const healthChange = forecast.projectedHealthScore - forecast.repositoryHealthScore;
  const healthChangeText = healthChange > 0 ? "improving" : healthChange < 0 ? "declining" : "stable";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Current Health */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">Current Health</h3>
          <BarChart3 className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {forecast.repositoryHealthScore}
          <span className="text-lg text-gray-500">/100</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Repository overall health</p>
      </div>

      {/* Projected Health */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">Projected (90d)</h3>
          <TrendingUp className="w-4 h-4 text-purple-500" />
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {forecast.projectedHealthScore}
          <span className="text-lg text-gray-500">/100</span>
        </div>
        <p
          className={`text-xs mt-1 ${
            healthChange > 0
              ? "text-green-600"
              : healthChange < 0
                ? "text-red-600"
                : "text-gray-500"
          }`}
        >
          {healthChange > 0 ? "↑" : healthChange < 0 ? "↓" : "→"} {healthChange > 0 ? "+" : ""}
          {healthChange} points ({healthChangeText})
        </p>
      </div>

      {/* Modules at Risk */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">At Risk</h3>
          <AlertTriangle className="w-4 h-4 text-orange-500" />
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {forecast.modulesAtRisk}
          <span className="text-lg text-gray-500">/{forecast.hotspotForecasts.length}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Modules requiring attention</p>
      </div>

      {/* Technical Debt */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-600">Tech Debt</h3>
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {forecast.criticalModules}
          <span className="text-lg text-gray-500"> critical</span>
        </div>
        <p
          className={`text-xs mt-1 ${
            forecast.technicalDebtTrend === "DECREASING"
              ? "text-green-600"
              : forecast.technicalDebtTrend === "INCREASING"
                ? "text-red-600"
                : "text-gray-500"
          }`}
        >
          Trend: {forecast.technicalDebtTrend}
        </p>
      </div>
    </div>
  );
}

/**
 * Risk Distribution Component
 */
function RiskDistribution({ forecast }: { forecast: RepositoryForecast }) {
  const { critical, high, medium, low } = forecast.riskDistribution;
  const total = critical + high + medium + low;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Distribution</h3>
      <div className="space-y-3">
        {[
          { label: "Critical", count: critical, color: "bg-red-500" },
          { label: "High", count: high, color: "bg-orange-500" },
          { label: "Medium", count: medium, color: "bg-yellow-500" },
          { label: "Low", count: low, color: "bg-green-500" },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold text-gray-900">
                {item.count} ({total > 0 ? Math.round((item.count / total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${item.color} h-2 rounded-full`}
                style={{
                  width: total > 0 ? `${(item.count / total) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hotspot Module Card Component
 */
function HotspotModuleCard({
  forecast,
  onSelect,
}: {
  forecast: HotspotForecast;
  onSelect?: (moduleId: string) => void;
}) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${RISK_COLORS[forecast.forecastRisk]}`}
      onClick={() => onSelect?.(forecast.moduleId)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{forecast.moduleName}</h4>
          <p className="text-xs opacity-75">Module ID: {forecast.moduleId}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${RISK_BADGE_COLORS[forecast.forecastRisk]}`}>
            {RISK_ICONS[forecast.forecastRisk]}
            {forecast.forecastRisk}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-600 mb-1">Complexity</p>
          <p className="text-lg font-bold">
            {forecast.currentComplexity}
            <span className="text-xs text-gray-600">
              {" "}
              ({forecast.complexityGrowthRate > 0 ? "+" : ""}
              {forecast.complexityGrowthRate.toFixed(1)}%/mo)
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Dependencies</p>
          <p className="text-lg font-bold">
            {forecast.dependencyCount}
            <span className="text-xs text-gray-600">
              {" "}
              ({forecast.dependencyGrowthRate > 0 ? "+" : ""}
              {forecast.dependencyGrowthRate.toFixed(1)}%/mo)
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <p className="text-gray-600">Size</p>
          <p className="font-semibold">{forecast.moduleSize} LOC</p>
        </div>
        <div>
          <p className="text-gray-600">Contributors</p>
          <p className="font-semibold">{forecast.contributorCount}</p>
        </div>
        <div>
          <p className="text-gray-600">Churn</p>
          <p className="font-semibold">{forecast.churnFrequency.toFixed(1)}/mo</p>
        </div>
      </div>

      <div className="mb-3 pb-3 border-t border-current border-opacity-20">
        <p className="text-xs font-semibold mb-2">Risk Indicators:</p>
        <div className="flex flex-wrap gap-1">
          {forecast.riskIndicators.slice(0, 3).map((indicator, idx) => (
            <span
              key={idx}
              className="inline-block bg-current bg-opacity-20 px-2 py-1 rounded text-xs"
              title={indicator.impact}
            >
              {indicator.name}
            </span>
          ))}
          {forecast.riskIndicators.length > 3 && (
            <span className="inline-block bg-current bg-opacity-20 px-2 py-1 rounded text-xs">
              +{forecast.riskIndicators.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div>
          <p className="text-gray-600">Confidence</p>
          <p className="font-semibold">{forecast.confidence}%</p>
        </div>
        <div className="text-right">
          <p className="text-gray-600">Projected Risk</p>
          <p className="font-semibold">{forecast.projectedRisk}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Recommendation Card Component
 */
function RecommendationCard({ recommendation }: { recommendation: ForecastRecommendation }) {
  const priorityColors = {
    LOW: "bg-green-50 border-green-200",
    MEDIUM: "bg-yellow-50 border-yellow-200",
    HIGH: "bg-orange-50 border-orange-200",
    CRITICAL: "bg-red-50 border-red-200",
  };

  const effortIcons = {
    TRIVIAL: "🎯",
    SMALL: "✓",
    MEDIUM: "⚡",
    LARGE: "⚠️",
    VERY_LARGE: "🚀",
  };

  return (
    <div className={`border rounded-lg p-4 ${priorityColors[recommendation.priority]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{recommendation.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{recommendation.description}</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-xs font-bold">
            {effortIcons[recommendation.effort]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <p className="text-gray-600">Category</p>
          <p className="font-semibold">{recommendation.category.replace(/_/g, " ")}</p>
        </div>
        <div>
          <p className="text-gray-600">Effort</p>
          <p className="font-semibold">{recommendation.effort}</p>
        </div>
        <div>
          <p className="text-gray-600">Impact</p>
          <p className="font-semibold">{recommendation.expectedImpact}%</p>
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-gray-700 hover:text-gray-900 mb-2">
          Implementation Details
        </summary>
        <ul className="list-disc list-inside space-y-1 text-gray-600 mt-2">
          {recommendation.implementationSteps.map((step, idx) => (
            <li key={idx} className="text-xs">
              {step}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * Main Hotspot Forecasting Component
 */
export function HotspotForecasting({
  forecast,
  onModuleSelect,
  isLoading = false,
  error = null,
}: HotspotForecastingProps) {
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter forecasts
  const filteredForecasts = useMemo(() => {
    return forecast.hotspotForecasts.filter((f) => {
      const matchesRisk = selectedRiskFilter === "ALL" || f.forecastRisk === selectedRiskFilter;
      const matchesSearch =
        searchQuery === "" ||
        f.moduleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.moduleId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    });
  }, [forecast.hotspotForecasts, selectedRiskFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Generating forecast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
        <p className="font-semibold mb-1">Error Loading Forecast</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold">Hotspot Forecasting</h2>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          {forecast.forecastWindow}-Day Forecast
        </span>
      </div>

      {/* Health Summary */}
      <HealthSummary forecast={forecast} />

      {/* Risk Distribution */}
      <RiskDistribution forecast={forecast} />

      {/* Top Recommendations */}
      {forecast.topRecommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Top Recommendations
          </h3>
          <div className="space-y-3">
            {forecast.topRecommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Module Forecasts */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Module Forecasts ({filteredForecasts.length})
        </h3>

        {/* Filters */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex flex-wrap gap-2">
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setSelectedRiskFilter(level)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  selectedRiskFilter === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {level === "ALL" ? "All" : level} (
                {level === "ALL"
                  ? forecast.hotspotForecasts.length
                  : forecast.hotspotForecasts.filter((f) => f.forecastRisk === level).length}
                )
              </button>
            ))}
          </div>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForecasts.map((hotspot) => (
            <HotspotModuleCard
              key={hotspot.moduleId}
              forecast={hotspot}
              onSelect={onModuleSelect}
            />
          ))}
        </div>

        {filteredForecasts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No modules found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Forecast Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div>
          <p className="font-semibold">Generated At</p>
          <p>{new Date(forecast.generatedAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="font-semibold">Average Complexity Growth</p>
          <p>
            {forecast.averageComplexityGrowth > 0 ? "+" : ""}
            {forecast.averageComplexityGrowth.toFixed(2)}% per month
          </p>
        </div>
        <div>
          <p className="font-semibold">Average Dependency Growth</p>
          <p>
            {forecast.averageDependencyGrowth > 0 ? "+" : ""}
            {forecast.averageDependencyGrowth.toFixed(2)}% per month
          </p>
        </div>
        <div>
          <p className="font-semibold">Health Trend</p>
          <p>{forecast.healthTrend}</p>
        </div>
      </div>
    </div>
  );
}

export default HotspotForecasting;
