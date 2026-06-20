"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { ContributorJourneyCategory, ContributorJourneyConfig, ContributorJourneyResult, ContributorExperienceLevel, CONTRIBUTOR_JOURNEY_CATEGORIES } from "@/types/contributorJourney";
import { RepositoryAnalysisData } from "@/types/contributionPath";
import { simulateContributorJourney } from "@/utils/contributorJourneySimulator";

const experienceLevels: ContributorExperienceLevel[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

interface ContributorJourneyPanelProps {
  repository?: RepositoryAnalysisData | null;
}

export function ContributorJourneyPanel({ repository }: ContributorJourneyPanelProps) {
  const [goal, setGoal] = useState("Add OAuth Provider");
  const [category, setCategory] = useState<ContributorJourneyCategory>("Authentication");
  const [experienceLevel, setExperienceLevel] = useState<ContributorExperienceLevel>("Intermediate");
  const [maxSteps, setMaxSteps] = useState(5);
  const [journey, setJourney] = useState<ContributorJourneyResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!goal.trim()) {
      return;
    }

    setIsGenerating(true);
    const config: ContributorJourneyConfig = {
      goal: goal.trim(),
      category,
      experienceLevel,
      maxSteps,
    };

    const result = simulateContributorJourney(repository || undefined, config);
    setJourney(result);
    setIsGenerating(false);
  };

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Contributor Journey Simulator</CardTitle>
        <CardDescription>
          Generate a guided learning path based on repository structure, core modules, and feature goals.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Goal</label>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Describe what you want to learn or build in this repository"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Learning category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ContributorJourneyCategory)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {CONTRIBUTOR_JOURNEY_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Experience level</label>
              <select
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value as ContributorExperienceLevel)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {experienceLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 sm:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">Max learning steps</label>
            <Input
              type="number"
              min={3}
              max={12}
              value={maxSteps}
              onChange={(event) => setMaxSteps(Math.max(3, Math.min(12, Number(event.target.value) || 5)))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={handleGenerate} disabled={isGenerating || !goal.trim()}>
            {isGenerating ? "Generating path..." : "Generate Learning Path"}
          </Button>
          <p className="text-xs text-muted-foreground max-w-xl">
            This simulator ranks files by repository importance, inferred entry points, and feature relevance.
          </p>
        </div>

        {journey ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Goal</p>
                  <p className="mt-1 text-lg font-semibold">{journey.goal}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated time</p>
                  <p className="mt-1 text-2xl font-semibold">{journey.estimatedTime} minutes</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-foreground">Category: <span className="font-medium">{journey.category}</span></p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recommended learning path
              </h3>
              <div className="mt-4 space-y-3">
                {journey.learningPath.map((step, index) => (
                  <details
                    key={step.file}
                    className="rounded-2xl border border-border/60 bg-background p-4"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                      <span>{index + 1}. {step.file}</span>
                      <span className="text-xs text-muted-foreground">{step.difficulty}</span>
                    </summary>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>{step.reason}</p>
                      <p>Estimated reading time: {step.estimatedTimeMinutes} min</p>
                      <p>Related category: {step.category}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 p-4 bg-background">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground">
                {journey.notes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            Generate a learning path to see the recommended files, difficulty labels, and estimated time.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
