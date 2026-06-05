import { githubService } from "./githubService";

export class DeploymentAnalysisService {
  /**
   * Fetches recent repository context (merged PRs, commits, release history)
   * leading up to an incident timestamp.
   */
  public async getRecentDeploymentContext(
    installationId: number,
    owner: string,
    repo: string,
    incidentTimestamp: string
  ): Promise<string> {
    try {
      // Ideally, we'd fetch PRs merged just before the incidentTimestamp
      // For this implementation, we'll fetch recent merged PRs.
      // Assuming githubService has a way to list PRs, or we can use the client directly.
      const client = (githubService as any).client;

      const incidentDate = new Date(incidentTimestamp);
      
      const { data: pullRequests } = await client.get(`/repos/${owner}/${repo}/pulls`, {
        params: { state: "closed", sort: "updated", direction: "desc", per_page: 20 }
      });

      const mergedPrs = pullRequests.filter(
        (pr: any) => pr.merged_at && new Date(pr.merged_at) <= incidentDate
      );

      const contextLines = mergedPrs.slice(0, 5).map((pr: any) => {
        return `PR #${pr.number}: ${pr.title} (Merged by ${pr.user?.login} at ${pr.merged_at}) - Commit: ${pr.merge_commit_sha}`;
      });

      if (contextLines.length === 0) {
        return "No recently merged PRs found before the incident.";
      }

      return contextLines.join("\n");
    } catch (error) {
      console.error("[DeploymentAnalysis] Error fetching deployment context:", error);
      return "Unable to retrieve recent deployment context due to an error.";
    }
  }
}

let deploymentAnalysisSingleton: DeploymentAnalysisService | null = null;

export function getDeploymentAnalysisService(): DeploymentAnalysisService {
  if (!deploymentAnalysisSingleton) {
    deploymentAnalysisSingleton = new DeploymentAnalysisService();
  }
  return deploymentAnalysisSingleton;
}
