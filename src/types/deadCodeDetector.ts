import { RepositoryFile } from "@/types/firstPRSimulator";

export type DeadCodeCategory =
  | "Component"
  | "Hook"
  | "Utility"
  | "API Route"
  | "Service"
  | "Page/Module"
  | "Unknown";

export interface DeadCodeFinding {
  path: string;
  category: DeadCodeCategory;
  confidence: number;
  incomingReferences: number;
  reason: string;
  suggestedAction: string;
}

export interface DeadCodeReport {
  findings: DeadCodeFinding[];
  totalCandidates: number;
  summary: string;
  repositoryFiles: number;
}

export interface DeadCodeDetectorInput {
  files: RepositoryFile[];
}
