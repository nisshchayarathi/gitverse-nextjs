/**
 * Types for Knowledge Gap Detector
 * Identifies critical files that lack sufficient documentation
 */

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface KnowledgeGapFile {
  path: string;
  fileName: string;
  riskLevel: RiskLevel;
  score: number;
  factors: GapFactor[];
  suggestedActions: string[];
}

export interface GapFactor {
  name: string;
  value: number | string;
  weight: number;
  description: string;
}

export interface KnowledgeGapReport {
  totalFilesAnalyzed: number;
  criticalGaps: KnowledgeGapFile[];
  highRiskGaps: KnowledgeGapFile[];
  mediumRiskGaps: KnowledgeGapFile[];
  repositoryHealthScore: number;
  insights: string[];
  generatedAt: string;
  recommendations: GapRecommendation[];
}

export interface GapRecommendation {
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  estimatedEffort: string;
  targetFiles: string[];
}

export interface DocumentationMetrics {
  totalFiles: number;
  documentedFiles: number;
  averageComments: number;
  averageComplexity: number;
  coveragePercentage: number;
}

export interface FileDependencyMap {
  file: string;
  inboundImports: number;
  outboundDependencies: string[];
  complexity: number;
  size: number;
  hasDocumentation: boolean;
  commentDensity: number;
}
