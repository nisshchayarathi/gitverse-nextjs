"use client";

import { useMemo } from "react";
import { Search, ShieldOff, Archive, ArrowRight } from "lucide-react";
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
import { buildDeadCodeReport } from "@/services/deadCodeDetectorService";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { RepositoryFile } from "@/types/firstPRSimulator";

interface DeadCodeDetectorProps {
  repository?: RepositoryAnalysisData | null;
  loading?: boolean;
}

export function DeadCodeDetector({ repository, loading = false }: DeadCodeDetectorProps) {
  const files = useMemo(() => (repository?.files || []) as RepositoryFile[], [repository?.files]);

  const report = useMemo(() => {
    if (!files.length) return null;
    return buildDeadCodeReport(files);
  }, [files]);

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Dead Code Detector</CardTitle>
          <CardDescription>Scanning repository dependencies for unused or orphaned files.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner message="Analyzing file usage patterns…" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!repository || !files.length) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>Dead Code Detector</CardTitle>
          <CardDescription>Identify potential unused code in the repository.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Archive}
            title="No repository files available"
            description="Load a repository with file metadata so the dead code detector can scan dependencies and usage patterns."
          />
        </CardContent>
      </Card>
    );
  }

  if (!report || report.findings.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Dead Code Detector</CardTitle>
              <CardDescription>Potential cleanup candidates based on dependency analysis.</CardDescription>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              No high-confidence candidates
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ShieldOff}
            title="No likely dead code detected"
            description="The repository dependency graph looks well-connected, with no obvious orphaned files."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Dead Code Detector</CardTitle>
            <CardDescription>
              {report.summary} Review the top findings before cleaning up unused code.
            </CardDescription>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {report.totalCandidates} candidates
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {report.findings.map((finding) => (
              <div
                key={finding.path}
                className="rounded-3xl border border-border/70 bg-background p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold break-all">{finding.path}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                        {finding.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{finding.reason}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                      Confidence: {finding.confidence}%
                    </span>
                    <Button variant="ghost" size="sm" className="border border-border/50 px-3 py-1 text-xs">
                      View details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Search className="h-4 w-4" />
                Cleanup recommendations
              </div>
              <div className="mt-3 space-y-3 text-sm text-foreground">
                <p>
                  Review each candidate and confirm whether the file is still reachable from application routes, component trees, or service consumers.
                </p>
                <p>
                  Files with low incoming references are likely to be safe cleanup candidates, but route entry points and runtime-loaded modules should be verified manually.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Archive className="h-4 w-4" />
                Suggested next step
              </div>
              <div className="mt-3 text-sm text-foreground">
                <p>Start cleanup with the highest-confidence candidates and preserve any application route or server entry files.</p>
                <p className="mt-2 text-xs text-muted-foreground">Narrow the candidate set before making deletions to avoid accidental removals.</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Detective mode</p>
          <p className="text-sm text-foreground">Use this report to highlight files for manual review and safe cleanup.</p>
        </div>
        <Button variant="secondary">Export cleanup report</Button>
      </CardFooter>
    </Card>
  );
}
