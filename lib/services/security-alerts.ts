import { RemediationSuggestion, SecretDetectionResult, SecretExposureReport } from "../../types/security-secrets";
import { secretRemediation } from "./secret-remediation";
import { secretReviewComments } from "./secret-review-comments";

export class SecurityAlertsService {
  public async handleExposure(
    repositoryId: string, 
    commitSha: string, 
    detectedSecrets: SecretDetectionResult[],
    pullRequestNumber?: number
  ): Promise<SecretExposureReport> {
    const report: SecretExposureReport = {
      repositoryId,
      pullRequestNumber,
      commitSha,
      detectedSecrets,
      remediationSuggestions: {},
      timestamp: new Date().toISOString()
    };

    const hasCritical = detectedSecrets.some(s => s.severity === 'Critical' && !s.isLikelySafe);

    for (const secret of detectedSecrets) {
      if (secret.isLikelySafe) continue; // Skip alerting for verified safe dummies

      const remediation = secretRemediation.generateRemediation(secret);
      report.remediationSuggestions[secret.match] = remediation;
      
      this.logAuditTrail(secret, remediation);

      if (pullRequestNumber) {
        await this.postReviewComment(repositoryId, pullRequestNumber, secret, remediation);
      }
    }

    if (hasCritical) {
      this.triggerHighPriorityAlert(repositoryId, commitSha);
    }

    return report;
  }

  private logAuditTrail(secret: SecretDetectionResult, remediation: RemediationSuggestion) {
    // Masking is crucial. Never log raw match.
    console.warn(`[AUDIT] Secret Exposure Detected!`);
    console.warn(`Provider: ${secret.provider} | Severity: ${secret.severity}`);
    console.warn(`File: ${secret.filePath} | Line: ${secret.lineNumber}`);
    console.warn(`Masked Value: ${secret.maskedMatch}`);
    console.warn(`Suggested Remediation: ${remediation.recommendation}`);
  }

  private async postReviewComment(repoId: string, prNumber: number, secret: SecretDetectionResult, remediation: RemediationSuggestion) {
    const commentBody = secretReviewComments.generateCommentBody(secret, remediation);
    // In a real implementation, this would use githubService to post the comment
    console.log(`[GitHub Mock] Posting review comment to PR #${prNumber} on repo ${repoId}:`);
    console.log(commentBody);
  }

  private triggerHighPriorityAlert(repoId: string, commitSha: string) {
    console.error(`[ALERT] CRITICAL secret detected in repo ${repoId}, commit ${commitSha}. Triggering notifications to repository administrators...`);
  }
}

export const securityAlerts = new SecurityAlertsService();
