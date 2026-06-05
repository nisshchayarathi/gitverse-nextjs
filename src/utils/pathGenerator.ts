import {
  ContributionDayPlan,
  ContributionMilestone,
  FocusArea,
  RecommendedFile,
  RecommendedIssue,
  RepositoryAnalysisData,
  ExperienceLevel,
} from "@/types/contributionPath";

const focusAreaLabels: Record<FocusArea, string[]> = {
  Frontend: ["components", "ui", "layout", "hooks", "styles"],
  Backend: ["api", "services", "lib", "middleware", "prisma"],
  "Full Stack": ["pages", "api", "services", "components", "hooks"],
  "AI/ML": ["ai", "services", "lib", "models", "utils"],
  DevOps: ["deploy", "scripts", "infra", "docker", "ci"],
};

const experienceIntensity: Record<ExperienceLevel, number> = {
  Beginner: 0.65,
  Intermediate: 0.85,
  Advanced: 1,
};

const getMatchScore = (path: string, focusArea: FocusArea) => {
  const normalized = path.toLowerCase();
  const keywords = focusAreaLabels[focusArea] || [];
  return keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 10 : 0), 0);
};

export function recommendFilesForContribution(
  repository?: RepositoryAnalysisData,
  focusArea: FocusArea = "Frontend",
): RecommendedFile[] {
  const files = repository?.files || [];

  return files
    .map((file) => ({
      path: file.path,
      reason: `Matches ${focusArea} focus area through path or filename patterns.`,
      confidence: Math.min(100, getMatchScore(file.path, focusArea) + 20),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

export function generateContributionRoadmap(
  experienceLevel: ExperienceLevel,
  focusArea: FocusArea,
  repository?: RepositoryAnalysisData,
): ContributionDayPlan[] {
  const intensity = experienceIntensity[experienceLevel] || 0.75;
  const rootPlans: ContributionDayPlan[] = [
    {
      day: "Day 1",
      summary: "Get comfortable with the repository and contribution workflow.",
      tasks: [
        "Read the README and contribution guidelines.",
        "Identify the feature area that matches your focus.",
        "Open the top recommended files to understand structure.",
      ],
      goals: ["Map repository structure", "Locate core modules", "Understand contribution expectations"],
    },
    {
      day: "Day 2",
      summary: "Explore the code paths and learn the key project concepts.",
      tasks: [
        "Review component or service files that support your focus area.",
        "Read the suggested learning concepts and notes.",
        "Check the repository's issue board for beginner-friendly tasks.",
      ],
      goals: ["Trace feature flow", "Identify a first contribution", "Build confidence"],
    },
    {
      day: "Day 3",
      summary: "Start contributing with a small, high-impact change.",
      tasks: [
        "Select a beginner-friendly issue or documentation improvement.",
        "Draft a small PR that follows repository conventions.",
        "Request feedback on your first contribution plan.",
      ],
      goals: ["Submit first PR", "Validate contribution path", "Learn review expectations"],
    },
  ];

  if (experienceLevel === "Advanced") {
    rootPlans.push({
      day: "Day 4",
      summary: "Tackle a more complex area and improve architecture.",
      tasks: [
        "Review backend or cross-cutting concerns in the repository.",
        "Propose improvements to tests, documentation, or architecture.",
        "Build a contribution that spans frontend and backend.",
      ],
      goals: ["Deliver broader impact", "Shape repo structure", "Drive quality improvements"],
    });
  }

  return rootPlans.map((plan) => ({
    ...plan,
    tasks: plan.tasks.slice(0, Math.max(2, Math.ceil(plan.tasks.length * intensity))),
    goals: plan.goals.slice(0, Math.max(2, Math.ceil(plan.goals.length * intensity))),
  }));
}

export function findBeginnerIssues(
  repository?: RepositoryAnalysisData,
  focusArea: FocusArea,
): RecommendedIssue[] {
  const candidateIssues = repository?.issues || [];

  if (candidateIssues.length === 0) {
    return [
      {
        id: "learn-docs",
        title: "Review documentation and repository onboarding notes.",
        labels: ["documentation"],
        path: "README.md",
        estimate: "1-2 hours",
      },
    ];
  }

  return candidateIssues
    .filter((issue) =>
      String(issue.title || "").toLowerCase().includes(focusArea.toLowerCase()) ||
      (issue.labels || []).some((label) =>
        label.name.toLowerCase().includes("good first issue") ||
        label.name.toLowerCase().includes("beginner") ||
        label.name.toLowerCase().includes(focusArea.toLowerCase()),
      ),
    )
    .map((issue) => ({
      id: issue.id?.toString() || "unknown",
      title: issue.title || "Beginner-friendly contribution",
      labels: (issue.labels || []).map((label) => label.name),
      path: issue.title?.toLowerCase().includes("docs") ? "README.md" : "src/",
      estimate: "2-4 hours",
    }))
    .slice(0, 5);
}

export function buildMilestones(
  experienceLevel: ExperienceLevel,
  focusArea: FocusArea,
): ContributionMilestone[] {
  const baseMilestones: ContributionMilestone[] = [
    {
      title: "Repository onboarding complete",
      progress: 20,
      description: "You understand the repository layout and contribution process.",
    },
    {
      title: "Concepts reviewed",
      progress: 45,
      description: "You have studied the key learning concepts for your focus area.",
    },
    {
      title: "First contribution planned",
      progress: 70,
      description: "You identified a specific issue or improvement to start with.",
    },
    {
      title: "First PR submitted",
      progress: 100,
      description: "You are ready to submit a first pull request with confidence.",
    },
  ];

  if (experienceLevel === "Advanced") {
    baseMilestones.splice(3, 0, {
      title: "Architecture review completed",
      progress: 85,
      description: "You reviewed a larger architectural area and identified improvements.",
    });
  }

  return baseMilestones;
}
