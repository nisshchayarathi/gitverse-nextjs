import { RemediationWorkflow } from "../../types/secret-remediation";
import { TokenRevocation } from "./token-revocation";

export class RemediationReport {
  /**
   * Generates a beautifully formatted security markdown report.
   */
  public static generate(workflow: RemediationWorkflow, prCreated = false): string {
    const maskedSecret = TokenRevocation.maskSecret(workflow.finding.rawSecret);
    
    return [
      `## Secret Remediation Report`,
      ``,
      `### Executive Summary`,
      `A potentially exposed credential was detected during the automated repository scanning phase. AI-powered remediation has been initiated to secure this resource.`,
      ``,
      `| Metric | Value |`,
      `| :--- | :--- |`,
      `| **Provider** | ${workflow.finding.provider} |`,
      `| **Severity** | **${workflow.finding.severity.toUpperCase()}** |`,
      `| **Affected File** | \`${workflow.finding.filePath}\` (Line: ${workflow.finding.line}) |`,
      `| **Confidence Score** | ${(workflow.finding.confidence * 100).toFixed(0)}% |`,
      `| **Remediation Action** | Environment variable migration |`,
      `| **Remediation PR Status** | ${prCreated ? "✅ Created" : "❌ Pending Approval"} |`,
      ``,
      `### Code Replacements Applied`,
      `\`\`\`diff`,
      `${workflow.codeDiff}`,
      `\`\`\``,
      ``,
      `### Environment Variable Guidance`,
      `To finalize the integration, verify that your environment files (such as \`.env.local\` or production configurations) define this key:`,
      `\`\`\`bash`,
      `${workflow.envExampleUpdate}`,
      `\`\`\``,
      ``,
      `> [!IMPORTANT]`,
      `> **Immediate Rotation Recommended:**`,
      `> We highly recommend treating this credential as compromised. Regardless of PR status, perform the following:`,
      `> 1. Revoke the exposed token (${maskedSecret}) in your ${workflow.finding.provider} developer dashboard.`,
      `> 2. Generate a new, secure token.`,
      `> 3. Update your production runtime parameters with the fresh secret.`,
    ].join("\n");
  }
}
