"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityAlerts = exports.SecurityAlertsService = void 0;
const secret_remediation_1 = require("./secret-remediation");
const secret_review_comments_1 = require("./secret-review-comments");
class SecurityAlertsService {
    async handleExposure(repositoryId, commitSha, detectedSecrets, pullRequestNumber) {
        const report = {
            repositoryId,
            pullRequestNumber,
            commitSha,
            detectedSecrets,
            remediationSuggestions: {},
            timestamp: new Date().toISOString()
        };
        const hasCritical = detectedSecrets.some(s => s.severity === 'Critical' && !s.isLikelySafe);
        for (const secret of detectedSecrets) {
            if (secret.isLikelySafe)
                continue; // Skip alerting for verified safe dummies
            const remediation = secret_remediation_1.secretRemediation.generateRemediation(secret);
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
    logAuditTrail(secret, remediation) {
        // Masking is crucial. Never log raw match.
        console.warn(`[AUDIT] Secret Exposure Detected!`);
        console.warn(`Provider: ${secret.provider} | Severity: ${secret.severity}`);
        console.warn(`File: ${secret.filePath} | Line: ${secret.lineNumber}`);
        console.warn(`Masked Value: ${secret.maskedMatch}`);
        console.warn(`Suggested Remediation: ${remediation.recommendation}`);
    }
    async postReviewComment(repoId, prNumber, secret, remediation) {
        const commentBody = secret_review_comments_1.secretReviewComments.generateCommentBody(secret, remediation);
        // In a real implementation, this would use githubService to post the comment
        console.log(`[GitHub Mock] Posting review comment to PR #${prNumber} on repo ${repoId}:`);
        console.log(commentBody);
    }
    triggerHighPriorityAlert(repoId, commitSha) {
        console.error(`[ALERT] CRITICAL secret detected in repo ${repoId}, commit ${commitSha}. Triggering notifications to repository administrators...`);
    }
}
exports.SecurityAlertsService = SecurityAlertsService;
exports.securityAlerts = new SecurityAlertsService();
