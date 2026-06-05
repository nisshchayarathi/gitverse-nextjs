import { RemediationSuggestion, SecretDetectionResult } from "../../types/security-secrets";

export class SecretReviewCommentsService {
  public generateCommentBody(result: SecretDetectionResult, remediation: RemediationSuggestion): string {
    return `### 🚨 Secret Exposure Detected

**Provider:** ${result.provider}
**Severity:** ${result.severity}

This PR appears to expose a sensitive credential. For security reasons, please do not commit raw secrets.

**Recommended Fix:**
\`\`\`suggestion
${remediation.recommendation}
\`\`\`

**Additional Steps Required:**
${remediation.additionalSteps.map(step => `- ${step}`).join('\n')}

*If this is a false positive (e.g., a dummy value), please safely ignore this warning.*`;
  }
}

export const secretReviewComments = new SecretReviewCommentsService();
