export type IssueCategory =
  | "bug"
  | "enhancement"
  | "documentation"
  | "refactor"
  | "performance"
  | "security"
  | "ui/ux"
  | "testing"
  | "question"
  | "unknown";

export type ComplexityLevel = "XS" | "S" | "M" | "L" | "XL";

export interface IssueClassification {
  category: IssueCategory;
  tags: string[]; // specific tags detected from the text
  confidence: number;
}

export interface ComplexityEstimation {
  complexity: ComplexityLevel;
  contributorDifficulty: string;
  beginnerFriendly: boolean;
  confidence: number;
}

export interface FileMatch {
  path: string;
  relevanceScore: number; // e.g. 0-100
  reasoning: string;
}

export interface IssueAnalysisResult {
  classification: IssueClassification;
  complexity: ComplexityEstimation;
  relevantFiles: FileMatch[];
  suggestedInvestigationPath: string;
}
