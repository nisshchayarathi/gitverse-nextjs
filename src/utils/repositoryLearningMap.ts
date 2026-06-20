import { FocusArea, RepositoryAnalysisData, RepositoryLearningConcept } from "@/types/contributionPath";

const commonConcepts: RepositoryLearningConcept[] = [
  {
    title: "Repository structure and conventions",
    description: "Understand how the repository organizes source code, tests, and configuration files.",
    category: "Repository Fundamentals",
  },
  {
    title: "Branching and PR workflows",
    description: "Learn how GitVerse prefers pull request flow and branch naming for contributions.",
    category: "Contributor Workflow",
  },
  {
    title: "Code review expectations",
    description: "Review the repository's contribution guidelines and code review practices before making changes.",
    category: "Collaboration",
  },
];

const focusAreaConcepts: Record<FocusArea, RepositoryLearningConcept[]> = {
  Frontend: [
    {
      title: "Component architecture",
      description: "Learn how UI components are composed, styled, and reused across the app.",
      category: "Frontend",
    },
    {
      title: "State and data flow",
      description: "Understand how state is managed and how data moves between components and services.",
      category: "Frontend",
    },
    {
      title: "Tailwind and design tokens",
      description: "Review how styling utilities are used consistently with Tailwind CSS and shared themes.",
      category: "Frontend",
    },
  ],
  Backend: [
    {
      title: "API route design",
      description: "Inspect server-side routes and request handling patterns in the repository.",
      category: "Backend",
    },
    {
      title: "Database and persistence",
      description: "Study how the repo models data and accesses it through Prisma and repository services.",
      category: "Backend",
    },
    {
      title: "Authentication and security",
      description: "Review how auth flows and access control are implemented across the backend.",
      category: "Backend",
    },
  ],
  "Full Stack": [
    {
      title: "End-to-end feature flow",
      description: "Trace a complete feature from UI interactions to backend processing.",
      category: "Full Stack",
    },
    {
      title: "Shared services and APIs",
      description: "Identify the boundary between frontend and backend logic in the repository.",
      category: "Full Stack",
    },
    {
      title: "Testing across layers",
      description: "Learn which tests cover UI components, services, and API routes.",
      category: "Full Stack",
    },
  ],
  "AI/ML": [
    {
      title: "AI-assisted developer tooling",
      description: "Explore how the repository integrates AI workflows and AI service abstractions.",
      category: "AI/ML",
    },
    {
      title: "Data flow and model usage",
      description: "Review how data is prepared, stored, and consumed by AI-enabled features.",
      category: "AI/ML",
    },
    {
      title: "Prompt and response handling",
      description: "Learn how prompts, API responses, and user interactions are managed in code.",
      category: "AI/ML",
    },
  ],
  DevOps: [
    {
      title: "Deployment and hosting",
      description: "Inspect deployment scripts and environment setup for cloud or platform hosting.",
      category: "DevOps",
    },
    {
      title: "CI/CD and pipeline automation",
      description: "Understand how repository changes are validated, built, and deployed.",
      category: "DevOps",
    },
    {
      title: "Monitoring and observability",
      description: "Learn what metrics and logs the project exposes for production readiness.",
      category: "DevOps",
    },
  ],
};

export function buildLearningMap(
  repository?: RepositoryAnalysisData,
  focusArea: FocusArea = "Frontend",
): RepositoryLearningConcept[] {
  const repoLanguages = repository?.languages?.map((language) => language.name.toLowerCase()) || [];
  const base = commonConcepts.slice(0, 2);
  const focusConcepts = focusAreaConcepts[focusArea] || focusAreaConcepts.Frontend;

  const languageHints: RepositoryLearningConcept[] = [];
  if (repoLanguages.includes("typescript") || repoLanguages.includes("javascript")) {
    languageHints.push({
      title: "Modern JavaScript/TypeScript patterns",
      description: "Review shared language idioms used across the repository.",
      category: "Language",
    });
  }
  if (repoLanguages.includes("sql") || repoLanguages.includes("prisma")) {
    languageHints.push({
      title: "Database schema and query patterns",
      description: "Understand how database models and queries are structured in this repo.",
      category: "Database",
    });
  }

  return [...base, ...focusConcepts.slice(0, 2), ...languageHints].slice(0, 6);
}
