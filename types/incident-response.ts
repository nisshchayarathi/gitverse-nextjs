export interface IncidentPayload {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  stackTrace?: string;
  affectedService?: string;
  timestamp: string; // ISO format
  environment: string;
  metadata?: Record<string, any>;
  source: "sentry" | "datadog" | "pagerduty" | "generic";
}

export interface CandidatePR {
  number: number;
  title: string;
  mergeCommitSha: string;
  mergedAt: string;
}

export interface IncidentCorrelation {
  likelyPrNumber?: number;
  likelyCommitSha?: string;
  impactedFiles: string[];
  impactedServices: string[];
  confidenceScore: number; // 0-100
  analysisDetails: string;
}

export interface RollbackResult {
  success: boolean;
  branchName?: string;
  prUrl?: string;
  prNumber?: number;
  autoMerged?: boolean;
  error?: string;
}

export interface IncidentReport {
  incidentId: string;
  summary: string;
  severity: string;
  likelyPrNumber?: number;
  confidenceScore: number;
  affectedFiles: string[];
  rollbackPrepared: boolean;
  emergencyPrUrl?: string;
  autoMerged: boolean;
  createdAt: string;
}
