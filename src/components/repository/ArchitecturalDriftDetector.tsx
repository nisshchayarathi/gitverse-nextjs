"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  GitBranch,
  Building2,
  Activity,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  EmptyState,
  Button,
  LoadingSpinner,
} from "@/components/ui";
import { buildArchitectureDriftReport, getSummaryMetrics, getRecommendedActions } from "@/services/architectureDriftService";
import { calculateRepositoryHealth, getHealthStatus, getHealthColor } from "@/utils/complexityCalculator";
import { generateArchitectureSnapshot } from "@/utils/snapshotGenerator";
import { compareSnapshots } from "@/utils/architectureComparison";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { RepositoryFile } from "@/types/firstPRSimulator";

interface ArchitecturalDriftDetectorProps {
  repository?: RepositoryAnalysisData | null;
  loading?: boolean;
}

export function ArchitecturalDriftDetector({ repository, loading = false }: ArchitecturalDriftDetectorProps) {
  const files = useMemo(() => (repository?.files || []) as RepositoryFile[], [repository?.files]);
  const [viewMode, setViewMode] = useState<"overview" | "comparison">("overview");

  const { currentSnapshot, health } = useMemo(() => {
    if (!files.length) return { currentSnapshot: null, health: null };
    return buildArchitectureDriftReport(files);
  }, [files]);

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Architectural Drift Detector</CardTitle>
          <CardDescription>Analyzing repository architecture and complexity trends.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner message="Scanning architecture metrics…" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!repository || !files.length || !currentSnapshot || !health) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Architectural Drift Detector</CardTitle>
          <CardDescription>Track repository architecture evolution and complexity trends.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Building2}
            title="No repository data available"
            description="Load a repository with file metadata to analyze architectural drift and complexity metrics."
          />
        </CardContent>
      </Card>
    );
  }

  const metrics = getSummaryMetrics(currentSnapshot);
  const healthStatus = getHealthStatus(health.health);
  const healthColor = getHealthColor(health.health);

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Architectural Drift Detector</CardTitle>
            <CardDescription>
              Repository architecture health and complexity analysis.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "overview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("overview")}
            >
              Overview
            </Button>
            <Button
              variant={viewMode === "comparison" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("comparison")}
            >
              Metrics
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {viewMode === "overview" && (
          <div className="space-y-6">
            {/* Health Score Card */}
            <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-background to-muted p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Repository Health</p>
                  <div className="mt-3 flex items-baseline gap-3">
                    <p className={`text-5xl font-bold ${healthColor}`}>{health.health}</p>
                    <p className="text-lg text-muted-foreground">/ 100</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{healthStatus}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Modularity</p>
                    <p className="mt-2 text-lg font-semibold">{health.modularity}%</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Cohesion</p>
                    <p className="mt-2 text-lg font-semibold">{health.cohesion}%</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Coupling</p>
                    <p className="mt-2 text-lg font-semibold">{health.coupling}%</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Complexity</p>
                    <p className="mt-2 text-lg font-semibold">{health.complexity}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Modules</p>
                    <p className="mt-2 text-2xl font-bold">{metrics.modules}</p>
                  </div>
                  <Building2 className="h-5 w-5 text-primary opacity-60" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Dependencies</p>
                    <p className="mt-2 text-2xl font-bold">{metrics.dependencies}</p>
                  </div>
                  <Activity className="h-5 w-5 text-accent opacity-60" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Complexity</p>
                    <p className="mt-2 text-2xl font-bold">{metrics.complexity}</p>
                  </div>
                  <Zap className="h-5 w-5 text-yellow-500 opacity-60" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Avg Coupling</p>
                    <p className="mt-2 text-2xl font-bold">{metrics.avgCoupling}</p>
                  </div>
                  <GitBranch className="h-5 w-5 text-orange-500 opacity-60" />
                </div>
              </div>
            </div>

            {/* Circular Dependencies Warning */}
            {metrics.circulars > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-300">{metrics.circulars} Circular Dependencies Detected</p>
                    <p className="mt-1 text-sm text-amber-200">
                      Consider refactoring to break these cycles and improve architecture clarity.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Module Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Module Breakdown</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentSnapshot.modules.slice(0, 6).map((module) => (
                  <div key={module.path} className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary">{module.type}</p>
                        <p className="text-sm font-medium break-all">{module.name}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary flex-shrink-0">
                        {module.complexity}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>Deps: {module.dependencies.length}</span>
                      <span>Used: {module.dependents.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === "comparison" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <h3 className="text-sm font-semibold mb-3">Key Insights</h3>
              <div className="space-y-2 text-sm text-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Modularity Score:</span>
                  <span className="font-semibold">{health.modularity}%</span>
                  <span className="text-xs text-muted-foreground">Indicates good module separation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cohesion:</span>
                  <span className="font-semibold">{health.cohesion}%</span>
                  <span className="text-xs text-muted-foreground">Measures internal connectivity</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Coupling:</span>
                  <span className="font-semibold">{health.coupling}%</span>
                  <span className="text-xs text-muted-foreground">Lower is better for flexibility</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
              <div className="space-y-2 text-sm">
                {health.modularity < 50 && (
                  <div className="flex gap-2 text-amber-300">
                    <span>→</span>
                    <span>Improve module boundaries to increase modularity</span>
                  </div>
                )}
                {health.coupling > 60 && (
                  <div className="flex gap-2 text-amber-300">
                    <span>→</span>
                    <span>High coupling detected. Consider introducing interfaces or facade patterns</span>
                  </div>
                )}
                {health.complexity > 70 && (
                  <div className="flex gap-2 text-amber-300">
                    <span>→</span>
                    <span>Reduce complexity by breaking down large modules</span>
                  </div>
                )}
                {health.health >= 80 && (
                  <div className="flex gap-2 text-emerald-300">
                    <span>✓</span>
                    <span>Architecture is well-structured. Maintain current patterns</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Architecture Analysis</p>
          <p className="text-sm text-foreground">Use these insights to guide refactoring and improvement initiatives.</p>
        </div>
        <Button variant="secondary">View full report</Button>
      </CardFooter>
    </Card>
  );
}
