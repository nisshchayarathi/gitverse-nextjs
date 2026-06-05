"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  EmptyState,
  Input,
} from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/Spinner";
import { buildContributionPathPlan } from "@/services/contributionPathService";
import {
  ContributionPreference,
  ContributionPathPlan,
  FocusArea,
  ExperienceLevel,
  RepositoryAnalysisData,
} from "@/types/contributionPath";

interface ContributionPathGeneratorProps {
  repository?: RepositoryAnalysisData | null;
  loading?: boolean;
}

const experienceLevels: ExperienceLevel[] = ["Beginner", "Intermediate", "Advanced"];
const focusAreas: FocusArea[] = ["Frontend", "Backend", "Full Stack", "AI/ML", "DevOps"];

const defaultPreference: ContributionPreference = {
  name: "Contributor",
  experienceLevel: "Beginner",
  focusArea: "Frontend",
};

export function ContributionPathGenerator({ repository, loading = false }: ContributionPathGeneratorProps) {
  const [preference, setPreference] = useState<ContributionPreference>(defaultPreference);
  const [name, setName] = useState(defaultPreference.name);

  const plan: ContributionPathPlan | null = useMemo(() => {
    if (!repository) return null;
    const currentPreference = { ...preference, name };
    return buildContributionPathPlan(currentPreference, repository);
  }, [preference, repository, name]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Path Generator</CardTitle>
          <CardDescription>Create a contributor onboarding roadmap based on repository analysis.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <LoadingSpinner message="Building your contribution path…" />
        </CardContent>
      </Card>
    );
  }

  if (!repository) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Path Generator</CardTitle>
          <CardDescription>Get a personalized contribution roadmap for this repository.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No repository selected"
            description="Open a repository to generate a contribution path tailored to your experience and focus."
          />
        </CardContent>
      </Card>
    );
  }

  const activePlan = plan;

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Contribution Path Generator</CardTitle>
        <CardDescription>
          Create a personalized contributor onboarding roadmap for this repository.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Your name</label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contributor name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Experience Level</label>
                <select
                  value={preference.experienceLevel}
                  onChange={(event) =>
                    setPreference((current) => ({
                      ...current,
                      experienceLevel: event.target.value as ExperienceLevel,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Focus Area</label>
                <select
                  value={preference.focusArea}
                  onChange={(event) =>
                    setPreference((current) => ({
                      ...current,
                      focusArea: event.target.value as FocusArea,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {focusAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Contributor Profile</p>
                <h3 className="mt-2 text-xl font-semibold">{activePlan?.profile.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{activePlan?.profile.experienceLevel} • {activePlan?.profile.focusArea}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activePlan?.badges.map((badge) => (
                    <span key={badge} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-foreground">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Score</p>
                    <p className="mt-2 text-3xl font-semibold">{activePlan?.completionScore}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="mt-2 text-3xl font-semibold">{activePlan?.progress}%</p>
                  </div>
                </div>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                    style={{ width: `${activePlan?.progress ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Feature Summary
            </p>
            <p className="mt-3 text-sm text-foreground leading-6">
              {activePlan?.summary}
            </p>
            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-border p-3 bg-background">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI readiness</p>
                <p className="mt-2 text-sm text-foreground">Future AI integration support is enabled for personalized learning plans.</p>
              </div>
              <div className="rounded-2xl border border-border p-3 bg-background">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hint</p>
                <p className="mt-2 text-sm text-foreground">{activePlan?.aiAssistantHint}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <section className="rounded-lg border border-border p-4">
              <h3 className="text-base font-semibold">Multi-day Roadmap</h3>
              <div className="mt-4 space-y-4">
                {activePlan?.roadmap.map((item) => (
                  <div key={item.day} className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.day}</span>
                      <span className="text-xs uppercase text-muted-foreground">{item.goals.length} goals</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tasks</p>
                        <ul className="mt-2 list-disc pl-5 text-sm text-foreground space-y-1">
                          {item.tasks.map((task) => (
                            <li key={task}>{task}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Goals</p>
                        <ul className="mt-2 list-disc pl-5 text-sm text-foreground space-y-1">
                          {item.goals.map((goal) => (
                            <li key={goal}>{goal}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">Recommended Files</h3>
                <div className="mt-4 space-y-3">
                  {activePlan?.recommendedFiles.length ? (
                    activePlan.recommendedFiles.map((file) => (
                      <div key={file.path} className="rounded-xl border border-white/10 p-3 bg-background">
                        <p className="font-medium">{file.path}</p>
                        <p className="text-xs text-muted-foreground">{file.reason}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-foreground">
                          <span className="rounded-full bg-primary/10 px-2 py-1">{file.confidence}%</span>
                          <span>Focus area match</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No file recommendations available yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">Suggested Issues</h3>
                <div className="mt-4 space-y-3">
                  {activePlan?.recommendedIssues.length ? (
                    activePlan.recommendedIssues.map((issue) => (
                      <div key={issue.id} className="rounded-xl border border-white/10 p-3 bg-background">
                        <p className="font-medium">{issue.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{issue.path} • {issue.estimate}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {issue.labels.map((label) => (
                            <span key={label} className="rounded-full bg-accent/10 px-2 py-1 text-muted-foreground">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No issues detected. Browse the issue board for first contribution opportunities.</p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-border p-4">
              <h3 className="text-base font-semibold">Learning Milestones</h3>
              <div className="mt-4 space-y-3">
                {activePlan?.milestones.map((milestone) => (
                  <div key={milestone.title} className="rounded-2xl border border-white/10 p-4 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{milestone.title}</p>
                      <span className="text-xs text-muted-foreground">{milestone.progress}%</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{milestone.description}</p>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${milestone.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h3 className="text-base font-semibold">First Contribution Opportunities</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground">
                {activePlan?.firstContributionOpportunities.map((opportunity) => (
                  <li key={opportunity}>{opportunity}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h3 className="text-base font-semibold">Learning Concepts</h3>
              <div className="mt-4 space-y-3">
                {activePlan?.learningConcepts.map((concept) => (
                  <div key={concept.title} className="rounded-xl border border-white/10 p-3 bg-background">
                    <p className="font-medium">{concept.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{concept.description}</p>
                    <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-1 text-xs text-muted-foreground">
                      {concept.category}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Progress Tracking</p>
          <p className="text-sm text-foreground">Use this plan to track your onboarding progress and milestones.</p>
        </div>
        <Button onClick={() => {}}>Export roadmap</Button>
      </CardFooter>
    </Card>
  );
}
