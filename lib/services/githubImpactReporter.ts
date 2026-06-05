import { GitHubService } from "./githubService";

export interface ImpactReportData {
  riskScore: string;
  impactSummary: string;
  affectedModules: string[];
  driftWarnings: string[];
  dependencyRisks: string[];
  recommendations: string[];
  mermaidGraph?: string;
}

export class GithubImpactReporter {
  public static async postImpactReport(githubToken: string, repoFullName: string, prNumber: number, data: ImpactReportData): Promise<void> {
    const reportMarker = "<!-- gitverse:pr-impact-report -->";
    
    // Construct the markdown comment
    let commentBody = `${reportMarker}\n# 📊 PR Impact & Architecture Analysis\n\n`;
    
    // Risk Score
    const riskEmoji = data.riskScore === "CRITICAL" ? "🚨" : data.riskScore === "HIGH" ? "🔴" : data.riskScore === "MEDIUM" ? "🟡" : "🟢";
    commentBody += `### Risk Score: ${riskEmoji} **${data.riskScore}**\n\n`;
    
    // Summary
    commentBody += `## Impact Summary\n${data.impactSummary}\n\n`;
    
    // Architectural Drift
    if (data.driftWarnings.length > 0) {
      commentBody += `## ⚠️ Architectural Drift Risks\n`;
      data.driftWarnings.forEach(w => commentBody += `- ${w}\n`);
      commentBody += `\n`;
    }
    
    // Dependency Risks
    if (data.dependencyRisks.length > 0) {
      commentBody += `## 🔗 Dependency Risks\n`;
      data.dependencyRisks.forEach(r => commentBody += `- ${r}\n`);
      commentBody += `\n`;
    }
    
    // Affected Modules
    if (data.affectedModules.length > 0) {
      commentBody += `## 📦 Affected Modules\n`;
      data.affectedModules.forEach(m => commentBody += `- \`${m}\`\n`);
      commentBody += `\n`;
    }
    
    // Recommendations
    if (data.recommendations.length > 0) {
      commentBody += `## 💡 Reviewer Recommendations\n`;
      data.recommendations.forEach(r => commentBody += `- ${r}\n`);
      commentBody += `\n`;
    }

    // Blast Radius Graph
    if (data.mermaidGraph) {
      commentBody += `## 🕸️ Blast Radius Dependency Graph\n\`\`\`mermaid\n${data.mermaidGraph}\n\`\`\`\n\n`;
    }

    try {
      const github = new GitHubService(githubToken);
      const [owner, repo] = repoFullName.split("/");

      // Find existing comment
      const existingComments = await github.getPullRequestComments(owner, repo, prNumber);
      const impactComment = existingComments?.find((c: any) => c.body?.includes(reportMarker));
      
      if (impactComment) {
        // Update existing comment
        await github.updatePullRequestComment(owner, repo, impactComment.id, commentBody);
      } else {
        // Create new comment
        await github.postPullRequestComment(owner, repo, prNumber, commentBody);
      }
    } catch (e) {
      console.error("Failed to post GitHub impact report:", e);
    }
  }
}
