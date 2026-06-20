import { ImpactReport } from "../../types/dependency-impact";

export class PRImpactCommentService {
  /**
   * Generates a markdown report for the PR comment.
   */
  generateMarkdownReport(report: ImpactReport): string {
    const { changedFiles, potentiallyAffectedFiles, riskLevel, reasoning, suggestedFollowUpChecks, confidenceScore } = report;

    // Define color indicator based on risk
    let riskIndicator = "🟢";
    if (riskLevel === "Medium") riskIndicator = "🟡";
    if (riskLevel === "High") riskIndicator = "🔴";

    // Format lists
    const changedFilesList = changedFiles.map(f => `* \`${f}\``).join("\n");
    const affectedFilesList = potentiallyAffectedFiles.length > 0
      ? potentiallyAffectedFiles.map(f => `* \`${f}\``).join("\n")
      : "* None detected.";
    const followUpsList = suggestedFollowUpChecks.map(s => `- [ ] ${s}`).join("\n");

    return `## GitVerse Dependency Impact Report

### Changed Files
${changedFilesList}

### Potentially Affected Areas
${affectedFilesList}

### Risk Assessment
**Level:** ${riskIndicator} ${riskLevel}

**Reason:**
${reasoning}

### Suggested Follow-Up Checks
${followUpsList}

### Confidence Score
**${confidenceScore}%**
`;
  }
}
