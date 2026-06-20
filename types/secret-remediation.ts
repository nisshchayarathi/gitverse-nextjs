export type SecretProvider = "AWS" | "GitHub" | "Stripe" | "SendGrid" | "Twilio" | "DatabaseURL" | "Generic";

export interface SecretFinding {
  provider: SecretProvider;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  rawSecret: string;
  filePath: string;
  line: number;
}

export interface RemediationWorkflow {
  finding: SecretFinding;
  secureReplacement: string;
  envVarName: string;
  envExampleUpdate: string;
  codeDiff: string;
  migrationGuidance: string;
}

export interface RevocationConfig {
  provider: string;
  allowAutoRevoke: boolean;
  adminApproved: boolean;
}

export interface RemediationPRDetails {
  branchName: string;
  prTitle: string;
  prBody: string;
  affectedFile: string;
}
