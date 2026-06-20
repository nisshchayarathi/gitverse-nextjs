export interface DriftAnalysisResult {
  hasDrift: boolean;
  driftConfidence: number; // 0-100
  outdatedDescriptions: string[];
  missingParameters: string[];
  removedParameters: string[];
  incorrectReturnValues: string[];
  staleExamples: string[];
  reasoning: string;
}

export interface DocumentationPatch {
  originalContent: string;
  suggestedContent: string;
  suggestedFixConfidence: number; // 0-100
  reasoning: string;
  summaryOfChanges: string;
}

export interface DriftDetectionJobContext {
  owner: string;
  repo: string;
  installationId: bigint;
  repositoryId: number;
}
