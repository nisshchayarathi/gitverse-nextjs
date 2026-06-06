"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/Spinner";
import { generateFirstPRSimulator } from "@/services/firstPRSimulatorService";
import { IssueData, RepositoryMetadata } from "@/types/firstPRSimulator";

interface FirstPRSimulatorProps {
  issue?: IssueData | null;
  repository?: RepositoryMetadata | null;
  loading?: boolean;
}

export function FirstPRSimulator({ issue, repository, loading = false }: FirstPRSimulatorProps) {
  const simulation = useMemo(() => {
    if (!issue) {
      return null;
    }

    return generateFirstPRSimulator(issue, repository ?? undefined);
  }, [issue, repository]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>First PR Simulator</CardTitle>
          <CardDescription>Preparing a guided first pull request plan for the selected issue.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner message="Simulating first PR impact…" />
        </CardContent>
      </Card>
    );
  }

  if (!issue) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>First PR Simulator</CardTitle>
          <CardDescription>Choose an issue to see a guided first PR breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Select an issue"
            description="The First PR Simulator will recommend target files, difficulty, and tests once an issue is chosen."
          />
        </CardContent>
      </Card>
    );
  }

  if (!simulation) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>First PR Simulator</CardTitle>
        <CardDescription>Based on issue content and repository structure, this simulator predicts a focused starting point.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-muted-foreground">Predicted Difficulty</div>
            <div className="mt-2 text-2xl font-semibold">{simulation.difficulty}</div>
            <div className="text-xs text-muted-foreground mt-1">Estimated size: {simulation.changeSize}</div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-muted-foreground">Confidence Score</div>
            <div className="mt-2 text-2xl font-semibold">{simulation.confidence}%</div>
            <div className="text-xs text-muted-foreground mt-1">Estimated line changes: {simulation.estimatedLines}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-sm font-medium text-muted-foreground">Issue keywords</div>
            <div className="flex flex-wrap gap-2">
              {simulation.issueAnalysis.keywords.length > 0 ? (
                simulation.issueAnalysis.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No strong keywords detected.</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-sm font-medium text-muted-foreground">Likely impact areas</div>
            <div className="flex flex-wrap gap-2">
              {simulation.issueAnalysis.affectedAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Top predicted files</h3>
            <div className="space-y-2">
              {simulation.predictedFiles.length > 0 ? (
                simulation.predictedFiles.map((prediction) => (
                  <div key={prediction.path} className="rounded-lg border border-border p-3">
                    <div className="text-sm font-semibold">{prediction.path}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{prediction.reason}</div>
                    <div className="mt-2 text-xs font-medium text-foreground">Confidence: {prediction.confidence}%</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  No file predictions available. Examine repository structure to identify likely impacted files.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium text-muted-foreground">Recommended starting point</div>
              <div className="text-sm font-semibold">{simulation.startingPoint.startHere}</div>
              <div className="mt-2 text-xs text-muted-foreground">{simulation.startingPoint.reason}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium text-muted-foreground">Suggested tests</div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                {simulation.suggestedTests.map((test) => (
                  <li key={test}>{test}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="space-y-3 px-4 pb-4 pt-0">
        <div>
          <div className="text-sm font-medium text-muted-foreground">Roadmap</div>
          <ol className="mt-3 space-y-2 text-sm text-foreground">
            {simulation.roadmapSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-semibold text-muted-foreground">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        {simulation.notes.length > 0 && (
          <div className="rounded-lg bg-muted p-4 text-sm text-foreground">
            <div className="mb-2 font-medium text-muted-foreground">Notes</div>
            <ul className="list-disc space-y-1 pl-5">
              {simulation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
