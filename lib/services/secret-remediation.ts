import { RemediationSuggestion, SecretDetectionResult } from "../../types/security-secrets";

export class SecretRemediationService {
  public generateRemediation(result: SecretDetectionResult): RemediationSuggestion {
    const providerMap: Record<string, string> = {
      'AWS': 'AWS_ACCESS_KEY_ID',
      'GCP': 'GOOGLE_APPLICATION_CREDENTIALS',
      'Stripe': 'STRIPE_SECRET_KEY',
      'GitHub': 'GITHUB_TOKEN',
      'GitLab': 'GITLAB_TOKEN',
      'MongoDB': 'MONGODB_URI',
      'PostgreSQL': 'DATABASE_URL',
      'JWT': 'JWT_SECRET',
    };

    const envVarName = providerMap[result.provider] || 'SECRET_KEY';
    
    let recommendation = `process.env.${envVarName}`;
    if (result.filePath.endsWith('.yaml') || result.filePath.endsWith('.yml')) {
      recommendation = `\${${envVarName}}`;
    } else if (result.filePath.endsWith('.json')) {
      recommendation = `"<Set via environment variables>"`;
    }

    return {
      recommendation,
      envExampleUpdate: `${envVarName}=your_${result.provider.toLowerCase()}_key_here`,
      additionalSteps: [
        `Rotate the exposed ${result.provider} credential immediately.`,
        `Update your deployment environment variables with the new key.`,
        `Revoke the compromised token in the ${result.provider} dashboard.`
      ]
    };
  }
}

export const secretRemediation = new SecretRemediationService();
