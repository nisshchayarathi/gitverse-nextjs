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
  ArchitectureSnapshot,
  DriftAnalysis,
  DriftSeverity,
} from "@/types/architectureDrift";
import {
  generateArchitectureSnapshot,
  analyzeDrift,
  calculateArchitectureMetrics,
} from "@/utils/architectureDriftDetector";
import {
  generateDriftSummary,
  requiresImmediateAction,
} from "@/utils/architectureDriftHelpers";
import { RepositoryAnalysisData } from "@/types/contributionPath";

interface ArchitectureDriftPanelProps {
  repository?: RepositoryAnalysisData | null;
  repositoryId?: string;
}

export function ArchitectureDriftPanel({
  repository,
  repositoryId = "default",
}: ArchitectureDriftPanelProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState<ArchitectureSnapshot | null>(
    null
  );
  const [previousSnapshot, setPreviousSnapshot] = useState<ArchitectureSnapshot | null>(
    null
  );
  const [driftAnalysis, setDriftAnalysis] = useState<DriftAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);

    // Simulate loading previous snapshot
    const mockPrevious: ArchitectureSnapshot = {
      id: `snapshot-${Date.now() - 86400000}`,
      repositoryId,
      timestamp: new Date(Date.now() - 86400000),
      snapshotDate: new Date(Date.now() - 86400000).toISOString().split("T")[0],
      label: "Previous Snapshot",
      modules: [],
      dependencyGraph: [],
      dependencies: [],
      totalDependencies: repository?.files?.length ? Math.floor(repository.files.length * 0.7) : 15,
      violationCount: 2,
      moduleCount: repository?.files?.length ? Math.floor(repository.files.length / 5) : 8,
      layerDistribution: {
        UI: 12,
        Services: 10,
        Database: 8,
        Auth: 5,
        API: 6,
        Utils: 15,
        Config: 3,
        Other: 5,
      },
      metrics: {
        moduleCount: repository?.files?.length ? Math.floor(repository.files.length / 5) : 8,
        totalDependencies: repository?.files?.length ? Math.floor(repository.files.length * 0.7) : 15,
        dependencyCount: repository?.files?.length ? Math.floor(repository.files.length * 0.7) : 15,
        circularDependencyCount: 0,
        averageCoupling: repository?.files?.length ? Math.max(0, Math.floor((repository.files.length * 0.7) / repository.files.length)) : 0,
        complexityScore: 0,
        criticalViolations: 0,
        highViolations: 0,
        mediumViolations: 0,
        lowViolations: 0,
        circularity: 0,
        coupling: 0,
        cohesion: 0,
        healthScore: 0,
      },
      metadata: {
        analysisVersion: "1.0.0",
        analysisDurationMs: 1500,
      },
    };

    const current = generateArchitectureSnapshot(repository || undefined, repositoryId);
    const analysis = analyzeDrift(current, mockPrevious);

    setCurrentSnapshot(current);
    setPreviousSnapshot(mockPrevious);
    setDriftAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const getSeverityColor = (severity: DriftSeverity | string): string => {
    const colors: Record<string, string> = {
      Critical: "bg-red-100 text-red-900 border-red-300",
      High: "bg-orange-100 text-orange-900 border-orange-300",
      Medium: "bg-yellow-100 text-yellow-900 border-yellow-300",
      Low: "bg-green-100 text-green-900 border-green-300",
    };
    return colors[severity] || colors.Low;
  };

  const metrics = currentSnapshot ? calculateArchitectureMetrics(currentSnapshot) : null;
  const summary = driftAnalysis ? generateDriftSummary(driftAnalysis) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Architecture Drift Tracker</CardTitle>
          <CardDescription>
            Monitor how repository architecture evolves and detect architectural decay
            before it becomes a maintenance problem.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg">
              {isAnalyzing ? "Analyzing Architecture..." : "Generate Drift Analysis"}
            </Button>
            <p className="text-xs text-muted-foreground max-w-xl">
              Analyzes repository structure, detects boundary violations, and identifies
              architectural drift patterns over time.
            </p>
          </div>

          {driftAnalysis && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Drift Score</p>
                      <p className={`text-3xl font-bold ${
                        driftAnalysis.driftScore > 50 ? "text-red-600" :
                        driftAnalysis.driftScore > 30 ? "text-yellow-600" :
                        "text-green-600"
                      }`}>
                        {driftAnalysis.driftScore.toFixed(1)}%
                      </p>
                      <p className={`text-sm font-medium ${getSeverityColor(driftAnalysis.riskLevel)}`}>
                        {driftAnalysis.riskLevel} Risk
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Coupling Score</p>
                      <p className="text-3xl font-bold">{driftAnalysis.couplingScore.toFixed(0)}/100</p>
                      <p className="text-sm text-muted-foreground">
                        {driftAnalysis.couplingScore > 70
                          ? "High coupling"
                          : driftAnalysis.couplingScore > 50
                          ? "Moderate coupling"
                          : "Low coupling"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Violations Found</p>
                      <p className="text-3xl font-bold">{driftAnalysis.currentSnapshot.violationCount}</p>
                      <p className="text-sm text-muted-foreground">
                        {driftAnalysis.newViolations.length} new
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Analysis */}
              {requiresImmediateAction(driftAnalysis) && (
                <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
                  <p className="font-semibold text-red-900">⚠️ Immediate Action Required</p>
                  <p className="mt-2 text-sm text-red-800">
                    Your repository shows signs of significant architectural drift. Consider
                    scheduling a refactoring session to address these violations.
                  </p>
                </div>
              )}

              {/* Summary */}
              {summary && (
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <h3 className="font-semibold">{summary.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{summary.description}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {Object.entries(summary.keyMetrics).map(([key, value]) => (
                      <div key={key} className="rounded border border-border bg-background p-3">
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="mt-1 text-lg font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Violations Detail */}
              {driftAnalysis.newViolations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    New Boundary Violations ({driftAnalysis.newViolations.length})
                  </h3>
                  <div className="space-y-2">
                    {driftAnalysis.newViolations.slice(0, 5).map((violation, index) => (
                      <div
                        key={`${violation.source}-${violation.target}-${index}`}
                        className="rounded-lg border border-red-200 bg-red-50 p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-900">
                              {violation.source} → {violation.target}
                            </p>
                            {violation.violationType && (
                              <p className="mt-1 text-xs text-red-700">
                                Type: {violation.violationType}
                              </p>
                            )}
                          </div>
                          <span className="inline-block rounded bg-red-200 px-2 py-1 text-xs font-semibold text-red-900">
                            Violation
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recommendations ({driftAnalysis.recommendations.length})
                </h3>
                <div className="space-y-3">
                  {driftAnalysis.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`rounded-lg border-2 p-4 ${getSeverityColor(rec.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{rec.title}</p>
                          <p className="mt-1 text-sm">{rec.description}</p>
                          <p className="mt-2 text-sm">
                            <strong>Action:</strong> {rec.action}
                          </p>
                          <p className="mt-1 text-sm">
                            <strong>Effort:</strong> {rec.estimatedEffort}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layer Distribution */}
              {currentSnapshot && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Layer Distribution
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {Object.entries(currentSnapshot.layerDistribution).map(
                      ([layer, count]) => (
                        <div
                          key={layer}
                          className="rounded border border-border bg-background p-3 text-center"
                        >
                          <p className="text-sm font-medium">{layer}</p>
                          <p className="mt-1 text-2xl font-bold text-primary">{count}</p>
                          <p className="text-xs text-muted-foreground">files</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Metrics Panel */}
              {metrics && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {showMetrics ? "▼" : "▶"} Detailed Metrics
                  </button>
                  {showMetrics && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {Object.entries(metrics).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded border border-border bg-background p-3"
                        >
                          <p className="text-xs text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, " $1")}
                          </p>
                          <p className="mt-2 text-xl font-bold">
                            {typeof value === "number" ? value.toFixed(1) : value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History Comparison */}
              {previousSnapshot && currentSnapshot && driftAnalysis && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    {showHistory ? "▼" : "▶"} Historical Comparison
                  </button>
                  {showHistory && (
                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold">Previous Snapshot</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {previousSnapshot.snapshotDate}
                          </p>
                          <ul className="mt-3 space-y-1 text-sm">
                            <li>Dependencies: {previousSnapshot.totalDependencies}</li>
                            <li>Violations: {previousSnapshot.violationCount}</li>
                            <li>Modules: {previousSnapshot.moduleCount}</li>
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Current Snapshot</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {currentSnapshot.snapshotDate}
                          </p>
                          <ul className="mt-3 space-y-1 text-sm">
                            <li>
                              Dependencies: {currentSnapshot.totalDependencies}
                              <span className={driftAnalysis.newDependencies.length > 0 ? "text-red-600 ml-2" : ""}>
                                {driftAnalysis.newDependencies.length > 0 && `+${driftAnalysis.newDependencies.length}`}
                              </span>
                            </li>
                            <li>
                              Violations: {currentSnapshot.violationCount}
                              <span className={driftAnalysis.newViolations.length > 0 ? "text-red-600 ml-2" : ""}>
                                {driftAnalysis.newViolations.length > 0 && `+${driftAnalysis.newViolations.length}`}
                              </span>
                            </li>
                            <li>Modules: {currentSnapshot.moduleCount}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!driftAnalysis && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Generate an analysis to view architecture drift metrics, violations, and
                recommendations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
