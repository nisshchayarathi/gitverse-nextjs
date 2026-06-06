export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced";
export type ChangeSizeEstimate = "Small" | "Medium" | "Large";

export interface IssueLabel {
  name: string;
  color?: string;
}

export interface IssueData {
  id: string;
  title: string;
  body?: string;
  labels?: IssueLabel[];
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  comments?: number;
}

export interface RepositoryFile {
  path: string;
  name?: string;
  size?: number;
  lines?: number;
  language?: string;
  content?: string;
  imports?: string[];
}

export interface RepositoryMetadata {
  id?: number | string;
  name?: string;
  files?: RepositoryFile[];
  languages?: Array<{ name: string; percentage: number; lines?: number }>;
  size?: number;
  openIssues?: number;
  commits?: Array<{
    hash?: string;
    message?: string;
    fileChanges?: Array<{ path: string; additions?: number; deletions?: number }>;
  }>;
}

export interface IssueAnalysisResult {
  keywords: string[];
  affectedAreas: string[];
  likelyModules: string[];
  confidence: number;
  summary: string;
}

export interface FilePrediction {
  path: string;
  confidence: number;
  reason: string;
}

export interface FirstPRRoadmap {
  startHere: string;
  reason: string;
  steps: string[];
}

export interface FirstPRSimulatorResult {
  issueAnalysis: IssueAnalysisResult;
  predictedFiles: FilePrediction[];
  difficulty: DifficultyLevel;
  changeSize: ChangeSizeEstimate;
  estimatedLines: number;
  startingPoint: FirstPRRoadmap;
  suggestedTests: string[];
  confidence: number;
  roadmapSteps: string[];
  notes: string[];
}
