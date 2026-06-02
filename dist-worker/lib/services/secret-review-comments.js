"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretReviewComments = exports.SecretReviewCommentsService = void 0;
class SecretReviewCommentsService {
    generateCommentBody(result, remediation) {
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
exports.SecretReviewCommentsService = SecretReviewCommentsService;
exports.secretReviewComments = new SecretReviewCommentsService();
