import { RepositoryAnalysisData } from "@/types/contributionPath";

export const CONTRIBUTOR_JOURNEY_CATEGORIES = [
  "Authentication",
  "API Layer",
  "Frontend UI",
  "State Management",
  "Database Layer",
  "Repository Analysis Features",
  "Custom Feature Requests",
] as const;

export type ContributorJourneyCategory = typeof CONTRIBUTOR_JOURNEY_CATEGORIES[number];
export type ContributorExperienceLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface ContributorJourneyConfig {
  goal: string;
  category?: ContributorJourneyCategory;
  experienceLevel?: ContributorExperienceLevel;
  maxSteps?: number;
}

export interface ContributorJourneyStep {
  file: string;
  reason: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  estimatedTimeMinutes: number;
  category: string;
}

export interface ContributorJourneyResult {
  goal: string;
  category: ContributorJourneyCategory;
  estimatedTime: number;
  learningPath: ContributorJourneyStep[];
  notes: string[];
  repository?: RepositoryAnalysisData;
}
