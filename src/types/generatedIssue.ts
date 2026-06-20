export type DifficultyCategory = "Beginner" | "Intermediate" | "Advanced";
export type OpportunityType =
  | "missing-tests"
  | "dead-code"
  | "refactoring"
  | "documentation"
  | "ui-consistency"
  | "type-safety"
  | "performance"
  | "accessibility";

export interface OpportunitySuggestion {
  type: OpportunityType;
  title: string;
  description: string;
  affectedFiles: string[];
  reason: string;
  estimatedEffort: "low" | "medium" | "high";
  difficulty: DifficultyCategory;
}

export interface GeneratedIssue {
  id: string;
  title: string;
  description: string;
  body: string;
  difficulty: DifficultyCategory;
  estimatedEffort: string;
  estimatedHours: number;
  suggestedLabels: string[];
  affectedFiles: string[];
  acceptanceCriteria: string[];
  resources?: string[];
  relatedIssues?: string[];
  opportunity: OpportunitySuggestion;
  confidence: number;
}

export interface RepositoryAnalysisMetrics {
  totalFiles: number;
  totalLines: number;
  filesByLanguage: Record<string, number>;
  testCoverage?: number;
  averageComplexity?: number;
  numberOfDependencies?: number;
  todoComments?: number;
  documentationRatio?: number;
  duplicateCodeRatio?: number;
}

export interface CodeQualityIssue {
  type: string;
  file: string;
  line?: number;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface GeneratorConfig {
  analyzeTestCoverage?: boolean;
  analyzeTodos?: boolean;
  analyzeDocumentation?: boolean;
  analyzeDuplicates?: boolean;
  minConfidenceScore?: number;
  maxIssuesPerCategory?: number;
}
