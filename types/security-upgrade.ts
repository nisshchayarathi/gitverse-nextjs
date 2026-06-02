export type VulnerabilitySeverity = "critical" | "high" | "medium" | "low";

export interface SecurityAdvisory {
  id: string;
  cveId: string;
  summary: string;
  severity: VulnerabilitySeverity;
  packageName: string;
  vulnerableVersionRange: string;
  patchedVersion: string;
}

export interface DependencyScanResult {
  packageName: string;
  currentVersion: string;
  isVulnerable: boolean;
  advisory?: SecurityAdvisory;
}

export interface MigrationPlan {
  packageName: string;
  fromVersion: string;
  toVersion: string;
  upgradeType: "patch" | "minor" | "major";
  breakingChangesDetected: boolean;
  refactoredFiles: {
    path: string;
    originalContent: string;
    newContent: string;
    confidenceScore: number;
  }[];
}

export interface ValidationResult {
  passed: boolean;
  testOutput: string;
  buildOutput: string;
  lintOutput: string;
}

export interface VulnerabilityReport {
  advisory: SecurityAdvisory;
  currentVersion: string;
  secureVersion: string;
  affectedFiles: string[];
  migrationConfidence: number;
  validationStatus: "Passed" | "Failed" | "Skipped";
  prUrl?: string;
}

export const AUTO_PATCH_CONFIDENCE_THRESHOLD = 90;
