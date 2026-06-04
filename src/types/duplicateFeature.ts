/**
 * Duplicate Feature Detection Types
 * Defines interfaces for duplicate code analysis, similarity matching, and refactoring recommendations
 */

export type FeatureType =
  | "validation"
  | "authentication"
  | "api-request"
  | "error-handling"
  | "utility"
  | "business-rule"
  | "data-transformation"
  | "state-management";

export type SimilarityMetric =
  | "ast-similarity"
  | "function-signature"
  | "dependencies"
  | "logic-pattern";

export interface CodeSnippet {
  fileId: string;
  fileName: string;
  filePath: string;
  functionName?: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  code?: string;
  hash?: string;
}

export interface SimilarityMatch {
  source: CodeSnippet;
  target: CodeSnippet;
  similarity: number; // 0-100
  matchType: SimilarityMetric;
  reason: string;
  sharedDependencies?: string[];
  commonPatterns?: string[];
}

export interface DuplicateCluster {
  id: string;
  featureName: string;
  featureType: FeatureType;
  description: string;
  instances: CodeSnippet[];
  matches: SimilarityMatch[];
  averageSimilarity: number; // 0-100
  totalLines: number;
  potentialSavings: number; // lines that could be reduced
  confidence: number; // 0-100
  severity: "low" | "medium" | "high"; // based on similarity and frequency
}

export interface RefactorRecommendation {
  clusterId: string;
  title: string;
  description: string;
  extractedName: string;
  targetLocation?: string; // suggested file path
  affectedFiles: string[];
  estimatedLinesReduced: number;
  estimatedComplexityReduction: number; // percentage
  dependencies: string[];
  riskLevel: "low" | "medium" | "high";
  implementationSteps: string[];
  estimatedEffort: "low" | "medium" | "high";
  estimatedHours: number;
  expectedBenefits: string[];
  potentialRisks: string[];
}

export interface DuplicateDetectionResult {
  clusterId: string;
  duplicates: DuplicateCluster;
  recommendation?: RefactorRecommendation;
  metrics: {
    totalDuplicates: number;
    totalAffectedFiles: number;
    totalDuplicatedLines: number;
    potentialSavingsPercentage: number;
    technicalDebtReduction: number; // estimated % improvement
  };
}

export interface RepositoryDuplicateAnalysis {
  totalClusters: number;
  totalDuplicates: number;
  totalAffectedFiles: number;
  totalDuplicatedLines: number;
  averageClusterSimilarity: number;
  clusters: DuplicateCluster[];
  recommendations: RefactorRecommendation[];
  summary: {
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    potentialImprovements: string[];
  };
}

export interface DuplicateDetectionConfig {
  minSimilarityThreshold?: number; // 0-100, default 70
  minLineThreshold?: number; // minimum lines to consider, default 10
  featureTypes?: FeatureType[]; // which types to detect
  excludePatterns?: string[]; // paths/files to exclude
  analysisDepth?: "quick" | "standard" | "thorough"; // default "standard"
}

export interface SimilarityAnalysisMetrics {
  astSimilarity: number;
  nameDistance: number; // levenshtein distance
  dependencySimilarity: number;
  patternSimilarity: number;
  overallScore: number;
}
