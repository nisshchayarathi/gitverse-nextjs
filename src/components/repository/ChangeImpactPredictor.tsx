"use client";

import { useMemo } from "react";
import { Zap, ShieldCheck, AlertTriangle, ArrowRight, CircleDot } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, LoadingSpinner } from "@/components/ui";
import { buildDependencyGraph, calculateChangeImpact, ChangeImpactResult, RepositoryFile } from "@/lib/changeImpact";

interface ChangeImpactPredictorProps {
  repository?: {
    files?: RepositoryFile[];
  };
  selectedFile?: RepositoryFile | null;
  loading?: boolean;
}

const badgeStyles: Record<string, string> = {
  Low: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  High: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
};

const renderListItems = (items: string[]) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">No dependencies were detected.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, 5).map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm">
          <CircleDot className="h-4 w-4 text-primary mt-1" />
          <span className="break-all">{item}</span>
        </li>
      ))}
      {items.length > 5 && (
        <li className="text-xs text-muted-foreground">
          +{items.length - 5} more files affected
        </li>
      )}
    </ul>
  );
};

const renderRiskNote = (riskLevel: string) => {
  if (riskLevel === "High") {
    return "Any change here requires careful review and regression testing.";
  }
  if (riskLevel === "Medium") {
    return "This file impacts shared logic — validate integration points.";
  }
  return "This file has a smaller impact surface, but testing is still recommended.";
};

export function ChangeImpactPredictor({ repository, selectedFile, loading }: ChangeImpactPredictorProps) {
  const files = useMemo(() => repository?.files || [], [repository?.files]);

  const graph = useMemo(() => buildDependencyGraph(files || []), [files]);

  const impact = useMemo<ChangeImpactResult | null>(() => {
    if (!selectedFile || !selectedFile.path) return null;
    return calculateChangeImpact(selectedFile, graph);
  }, [graph, selectedFile]);

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-heading">Change Impact Predictor</CardTitle>
          <CardDescription>Evaluating file dependencies and risk score.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Analyzing dependency relationships..." />
        </CardContent>
      </Card>
    );
  }

  if (!selectedFile) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-heading">Change Impact Predictor</CardTitle>
          <CardDescription>Click a repository file to view its estimated impact.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Zap}
            title="Select a file"
            description="The predictor analyzes dependency relationships and highlights risk when you choose a file."
          />
        </CardContent>
      </Card>
    );
  }

  if (!impact) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-heading">Change Impact Predictor</CardTitle>
          <CardDescription>Unable to compute impact for the selected file.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The selected file metadata does not include enough dependency data to calculate risk.
            </p>
            <p className="text-sm text-muted-foreground">
              If your repository exposes import/export metadata or file content, this analysis will become more accurate.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-heading">Change Impact Predictor</CardTitle>
            <CardDescription>
              Predicts the potential impact of modifying <span className="font-semibold">{selectedFile.path}</span>.
            </CardDescription>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[impact.riskLevel]}`}>
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            {impact.riskLevel.toUpperCase()}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Direct Dependencies</p>
                <p className="mt-3 text-3xl font-bold">{impact.directDependencies.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Indirect Dependencies</p>
                <p className="mt-3 text-3xl font-bold">{impact.indirectDependencies.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Dependency Depth</p>
                <p className="mt-3 text-3xl font-bold">{impact.dependencyDepth}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Risk score</p>
                  <p className="mt-2 text-4xl font-bold">{impact.riskScore}</p>
                </div>
                <div className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Critical weight {impact.criticalModuleWeight}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {renderRiskNote(impact.riskLevel)}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Affected Areas</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {impact.affectedAreas.map((area) => (
                    <span key={area} className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recommended Tests</h3>
                <div className="mt-3 space-y-2">
                  {impact.recommendedTests.map((test) => (
                    <div key={test} className="rounded-xl bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                      {test}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Direct Dependency Preview</h3>
              <div className="mt-4 max-h-[240px] overflow-y-auto pr-2">
                {renderListItems(impact.dependencyDetails.direct)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Indirect Dependency Preview</h3>
              <div className="mt-4 max-h-[240px] overflow-y-auto pr-2">
                {renderListItems(impact.dependencyDetails.indirect)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Future Prediction Ready</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This predictor is built with reusable dependency traversal logic and can be extended for PR-level impact predictions.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
