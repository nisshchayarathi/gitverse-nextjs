"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  RecentActivityAnalysis,
  TimeWindow,
  TIME_WINDOWS,
} from "@/types/recentlyActiveAreas";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import {
  analyzeRecentActivity,
  calculateActivityMetrics,
} from "@/utils/recentlyActiveAreasDetector";
import {
  generateActivitySummary,
  formatTimeWindow,
  generateActivityInsights,
  suggestNextActions,
  formatDateDiff,

} from "@/utils/recentlyActiveAreasHelpers";
import {
  getActivityLevelDisplay,
  getVelocityDisplay,
  getHealthIndicatorDisplay,
  AREA_TYPE_ICONS,
} from "@/config/recentlyActiveAreasConfig";

interface RecentlyActiveAreasPanelProps {
  repository?: RepositoryAnalysisData | null;
  repositoryId?: string;
}

export function RecentlyActiveAreasPanel({
  repository,
  repositoryId = "default",
}: RecentlyActiveAreasPanelProps) {
  const [analysis, setAnalysis] = useState<RecentActivityAnalysis | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("month");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    const result = analyzeRecentActivity(repository || undefined, repositoryId, timeWindow);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const metrics = analysis ? calculateActivityMetrics(analysis) : null;
  const summary = analysis ? generateActivitySummary(analysis) : null;
  const insights = analysis ? generateActivityInsights(analysis) : [];
  const nextActions = analysis ? suggestNextActions(analysis) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recently Active Areas</CardTitle>
          <CardDescription>
            Discover which modules, folders, and services are receiving the most recent development
            activity in your repository.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Time Window Selector */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Analyze Period</label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(TIME_WINDOWS).map(([key]) => (
                  <option key={key} value={key}>
                    {formatTimeWindow(key as TimeWindow)}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg" className="mt-auto">
              {isAnalyzing ? "Analyzing Activity..." : "Analyze Activity"}
            </Button>
          </div>

          {analysis && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-sm text-foreground">{summary}</p>
              </div>

              {/* Health Indicator */}
              {metrics && (
                <div className="rounded-2xl border border-border p-4">
                  {(() => {
                    const display = getHealthIndicatorDisplay(metrics.healthIndicator);
                    return (
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{display.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">{display.label}</p>
                            <p className="text-xs text-muted-foreground">{display.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Top Active Areas */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Most Active Areas ({analysis.topActiveAreas.length})
                </h3>
                <div className="space-y-3">
                  {analysis.topActiveAreas.slice(0, 5).map((area) => {
                    const display = getActivityLevelDisplay(area.activityScore);
                    const velocityDisplay = getVelocityDisplay(area.changeVelocity);

                    return (
                      <div
                        key={area.id}
                        className="rounded-lg border border-border bg-background p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{AREA_TYPE_ICONS[area.type] || "📁"}</span>
                              <div>
                                <p className="font-semibold">{area.name}</p>
                                <p className="text-xs text-muted-foreground">{area.path}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ backgroundColor: display.color, color: "white" }}
                            >
                              {Math.round(area.activityScore)}/100
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 mb-3">
                          <div className="rounded border border-border/60 bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">Commits</p>
                            <p className="mt-1 text-lg font-bold">{area.commitsInPeriod}</p>
                          </div>
                          <div className="rounded border border-border/60 bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">Contributors</p>
                            <p className="mt-1 text-lg font-bold">{area.uniqueContributors}</p>
                          </div>
                          <div className="rounded border border-border/60 bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">Files Changed</p>
                            <p className="mt-1 text-lg font-bold">{area.totalFilesChanged}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span>{velocityDisplay.icon}</span>
                            <span className="text-muted-foreground">{velocityDisplay.label}</span>
                          </div>
                          <span className="text-muted-foreground">
                            Last: {formatDateDiff(area.lastUpdated)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Insights */}
              {insights.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowInsights(!showInsights)}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {showInsights ? "▼" : "▶"} Key Insights
                  </button>
                  {showInsights && (
                    <div className="space-y-2">
                      {insights.map((insight, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
                        >
                          {insight}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Next Actions */}
              {nextActions.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">💡 Suggested Next Steps</p>
                  <ul className="space-y-2">
                    {nextActions.map((action, index) => (
                      <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Recommendations
                  </h3>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-border p-4 bg-background"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="font-semibold text-sm">{rec.title}</p>
                          <span
                            className="text-xs font-bold px-2 py-1 rounded"
                            style={{
                              backgroundColor:
                                rec.priority === "high"
                                  ? "#dc2626"
                                  : rec.priority === "medium"
                                  ? "#f59e0b"
                                  : "#3b82f6",
                              color: "white",
                            }}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                        <p className="text-xs"><strong>Action:</strong> {rec.action}</p>
                        <p className="text-xs text-muted-foreground">
                          Impact: {rec.estimatedImpact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Metrics */}
              {metrics && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {showMetrics ? "▼" : "▶"} Activity Metrics
                  </button>
                  {showMetrics && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ["Total Activity", Math.round(metrics.totalActivity)],
                        ["Commits/Day", metrics.averageCommitsPerDay.toFixed(1)],
                        ["Files/Commit", metrics.averageFilesPerCommit.toFixed(1)],
                        ["Core Areas", metrics.coreAreasCount],
                        ["Emerging Areas", metrics.emergingAreasCount],
                        ["Declining Areas", metrics.dormantAreasCount],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded border border-border bg-background p-3"
                        >
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-2 text-xl font-bold">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Trends */}
              {analysis.activityTrends.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowTrends(!showTrends)}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {showTrends ? "▼" : "▶"} Activity Trends
                  </button>
                  {showTrends && (
                    <div className="space-y-2">
                      {analysis.activityTrends.map((trend, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3"
                        >
                          <div className="flex items-center justify-between text-sm mb-1">
                            <p className="font-semibold">{trend.period}</p>
                            <p className="text-muted-foreground">
                              {trend.totalCommits} commits
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Areas: {trend.activeAreas}</span>
                            <span>•</span>
                            <span>Contributors: {trend.topContributors}</span>
                            <span>•</span>
                            <span>Files: {trend.changedFiles}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!analysis && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Analyze recent activity to see which areas are actively being developed, trending
                commits, contributor engagement, and actionable insights.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
