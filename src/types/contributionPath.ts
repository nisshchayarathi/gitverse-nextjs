/**
 * Contribution Path Types
 * Defines types for repository analysis and contribution data
 */

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";
export type FocusArea = "Frontend" | "Backend" | "Full Stack" | "AI/ML" | "DevOps";

export interface ContributionPreference {
  name: string;
  experienceLevel: ExperienceLevel;
  focusArea: FocusArea;
}

export interface RepositoryFile {
  path: string;
  name?: string;
  language?: string;
  size?: number;
  lines?: number;
  extension?: string;
  type?: string;
  importance?: number;
  category?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface ContributorInfo {
  name: string;
  email?: string;
  commits: number;
  additions?: number;
  deletions?: number;
  percentage?: number;
  firstCommit?: Date;
  lastCommit?: Date;
}

export interface CommitData {
  hash: string;
  shortHash?: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: number;
  additions?: number;
  deletions?: number;
  branch?: string;
}

export interface RepositoryInsight {
  title: string;
  description: string;
  type: "positive" | "warning" | "info";
  metric?: string;
  value?: string | number;
}

export interface RepositoryAnalysisData {
  id?: string | number;
  repositoryId?: string | number;
  name?: string;
  description?: string;
  url?: string;
  size?: number;
  files: RepositoryFile[];
  commits?: CommitData[];
  contributors?: ContributorInfo[];
  commitHash?: string;
  analysisDate?: Date;
  totalFiles?: number;
  totalCommits?: number;
  totalContributors?: number;
  insights?: RepositoryInsight[];
  languages?: Array<{
    name: string;
    percentage: number;
    bytes?: number;
    lines?: number;
  }>;
  statistics?: {
    totalInsertions?: number;
    totalDeletions?: number;
    averageFilesPerCommit?: number;
    averageContributorCommits?: number;
  };
  issues?: Array<{ id?: string | number; title?: string; labels?: Array<{ name: string }>; state?: string }>;
  metadata?: Record<string, unknown>;
}

export interface ContributionDayPlan {
  day: string;
  summary: string;
  tasks: string[];
  goals: string[];
}

export interface RepositoryLearningConcept {
  title: string;
  description: string;
  category: string;
}

export interface RecommendedFile {
  path: string;
  reason: string;
  confidence: number;
}

export interface RecommendedIssue {
  id: string;
  title: string;
  labels: string[];
  path: string;
  estimate: string;
}

export interface ContributionMilestone {
  title: string;
  progress: number;
  description: string;
}

export interface ContributionProfile {
  name: string;
  experienceLevel: ExperienceLevel;
  focusArea: FocusArea;
  score: number;
  badge: string;
}

export interface ContributionPathPlan {
  profile: ContributionProfile;
  roadmap: ContributionDayPlan[];
  recommendedFiles: RecommendedFile[];
  learningConcepts: RepositoryLearningConcept[];
  recommendedIssues: RecommendedIssue[];
  firstContributionOpportunities: string[];
  milestones: ContributionMilestone[];
  completionScore: number;
  progress: number;
  badges: string[];
  summary: string;
  aiAssistantHint: string;
  futureAIReady: boolean;
}