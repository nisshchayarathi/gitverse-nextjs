export type RiskLevel = "Low" | "Medium" | "High";

export interface ImpactReport {
  changedFiles: string[];
  potentiallyAffectedFiles: string[];
  riskLevel: RiskLevel;
  reasoning: string;
  suggestedFollowUpChecks: string[];
  confidenceScore: number;
}

export type DependencyGraph = Map<string, string[]>;
