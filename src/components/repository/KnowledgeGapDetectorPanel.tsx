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
import { AlertCircle, CheckCircle, TrendingUp, RefreshCw } from "lucide-react";
import { KnowledgeGapReport, RiskLevel } from "@/types/knowledgeGapDetector";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { detectKnowledgeGaps, getHealthScoreBadge } from "@/utils/knowledgeGapDetector";

interface KnowledgeGapDetectorPanelProps {
  repository?: RepositoryAnalysisData | null;
}

const riskColors = {
  Critical: "bg-red-500/10 border-red-500/30 text-red-700",
  High: "bg-orange-500/10 border-orange-500/30 text-orange-700",
  Medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700",
  Low: "bg-blue-500/10 border-blue-500/30 text-blue-700",
};

const riskIcons = {
  Critical: AlertCircle,
  High: AlertCircle,
  Medium: TrendingUp,
  Low: CheckCircle,
};

export function KnowledgeGapDetectorPanel({ repository }: KnowledgeGapDetectorPanelProps) {
  const [report, setReport] = useState<KnowledgeGapReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    const analysisResult = detectKnowledgeGaps(repository || undefined);
    setReport(analysisResult);
    setIsAnalyzing(false);
  };

  const healthBadge = report ? getHealthScoreBadge(report.repositoryHealthScore) : null;

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Knowledge Gap Detector</CardTitle>
        <CardDescription>
          Identify critical files lacking sufficient documentation that may slow down contributor onboarding.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Repository"
            )}
          </Button>
          <p className="text-xs text-muted-foreground max-w-xl">
            Scans for files with high complexity, many dependencies, and insufficient documentation.
          </p>
        </div>

        {report ? (
          <div className="space-y-6">
            {/* Health Score */}
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Documentation Health Score</p>
                  <p className="mt-1 text-4xl font-bold">{report.repositoryHealthScore}</p>
                  <p className="mt-1 text-sm font-medium text-accent">{healthBadge}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-sm text-muted-foreground">Total Files Analyzed</p>
                  <p className="text-2xl font-semibold">{report.totalFilesAnalyzed}</p>
                </div>
              </div>
            </div>

            {/* Critical Gaps */}
            {report.criticalGaps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Critical Knowledge Gaps ({report.criticalGaps.length})
                </h3>
                <div className="space-y-3">
                  {report.criticalGaps.map((gap) => (
                    <GapCard key={gap.path} gap={gap} />
                  ))}
                </div>
              </div>
            )}

            {/* High Risk Gaps */}
            {report.highRiskGaps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  High Risk Gaps ({report.highRiskGaps.length})
                </h3>
                <div className="space-y-3">
                  {report.highRiskGaps.slice(0, 3).map((gap) => (
                    <GapCard key={gap.path} gap={gap} />
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {report.insights.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Insights
                </h3>
                <ul className="space-y-2">
                  {report.insights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-foreground flex gap-2">
                      <span className="text-accent">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border/60 bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{rec.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              Priority: {rec.priority}
                            </span>
                            <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                              {rec.estimatedEffort}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Click "Analyze Repository" to identify knowledge gaps and documentation opportunities.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapCard({ gap }: { gap: any }) {
  const RiskIcon = riskIcons[gap.riskLevel as RiskLevel];

  return (
    <div className={`rounded-2xl border p-4 ${riskColors[gap.riskLevel as RiskLevel]}`}>
      <div className="flex items-start gap-3">
        <RiskIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-semibold text-sm truncate">{gap.fileName}</p>
            <span className="text-xs font-medium px-2 py-1 rounded bg-background/30">
              {gap.riskLevel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 break-words">{gap.path}</p>
          <p className="text-xs mb-2">Risk Score: {gap.score.toFixed(1)}/100</p>
          {gap.suggestedActions.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">Suggested Actions ({gap.suggestedActions.length})</summary>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {gap.suggestedActions.map((action: string, idx: number) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
