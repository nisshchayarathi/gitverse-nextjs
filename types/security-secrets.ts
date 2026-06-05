export type SecretSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type SecretProvider = 
  | 'AWS'
  | 'GCP'
  | 'Azure'
  | 'GitHub'
  | 'GitLab'
  | 'Vercel'
  | 'Netlify'
  | 'Stripe'
  | 'Razorpay'
  | 'Twilio'
  | 'SendGrid'
  | 'MongoDB'
  | 'PostgreSQL'
  | 'JWT'
  | 'Generic API Key'
  | 'OAuth Secret'
  | 'Unknown';

export interface SecretDetectionResult {
  provider: SecretProvider;
  severity: SecretSeverity;
  match: string;
  maskedMatch: string;
  lineNumber: number;
  filePath: string;
  entropyScore: number;
  confidenceScore: number;
  isLikelySafe: boolean; // Dummy or example
}

export interface RemediationSuggestion {
  recommendation: string;
  envExampleUpdate: string;
  additionalSteps: string[];
}

export interface SecretExposureReport {
  repositoryId: string;
  pullRequestNumber?: number;
  commitSha: string;
  detectedSecrets: SecretDetectionResult[];
  remediationSuggestions: Record<string, RemediationSuggestion>; // Keyed by secret match or type
  timestamp: string;
}
