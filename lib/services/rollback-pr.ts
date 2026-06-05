import { githubService } from "./githubService";
import { getRevertGeneratorService } from "./revert-generator";
import { getIncidentReportService } from "./incident-report";
import { IncidentPayload, IncidentCorrelation, RollbackResult } from "@/types/incident-response";

export class RollbackPrService {
  /**
   * Orchestrates the creation of an emergency rollback PR.
   */
  public async executeRollback(
    installationId: number,
    owner: string,
    repo: string,
    incident: IncidentPayload,
    correlation: IncidentCorrelation
  ): Promise<RollbackResult> {
    console.log(`[RollbackPr] Starting rollback for PR #${correlation.likelyPrNumber}`);

    if (!correlation.likelyPrNumber) {
      return {
        success: false,
        error: "No likely PR identified to rollback.",
      };
    }

    const MIN_ROLLBACK_CONFIDENCE = parseInt(process.env.MIN_ROLLBACK_CONFIDENCE || "85", 10);
    
    if (correlation.confidenceScore < MIN_ROLLBACK_CONFIDENCE) {
      return {
        success: false,
        error: `Confidence score (${correlation.confidenceScore}) is below threshold (${MIN_ROLLBACK_CONFIDENCE}). Human review required.`,
      };
    }

     try {
       const client = (githubService as any).client;

       // 1. Generate Revert Branch
       const revertGenerator = getRevertGeneratorService();
       const revertBranchName = await revertGenerator.createRevertBranch(
         installationId,
         owner,
         repo,
         correlation.likelyCommitSha || "",
         incident.id
       );

       // 2. Get repository information to determine default branch
       const repository = await githubService.getRepository(owner, repo);
       const baseBranch = repository.default_branch;

       // 3. Generate Incident Report for PR Body
       const reportService = getIncidentReportService();
       const prBody = reportService.generatePrDescription(incident, correlation);

       // 4. Create Emergency PR
       const { data: pr } = await client.post(`/repos/${owner}/${repo}/pulls`, {
         title: `🚨 Emergency Rollback: Revert PR #${correlation.likelyPrNumber} after production incident`,
         head: revertBranchName,
         base: baseBranch,
         body: prBody,
       });

      console.log(`[RollbackPr] Created emergency rollback PR: ${pr.html_url}`);

      // 4. Auto-merge logic
      const AUTO_ROLLBACK_ENABLED = process.env.AUTO_ROLLBACK_ENABLED === "true";
      let autoMerged = false;

      if (AUTO_ROLLBACK_ENABLED) {
        try {
          await client.put(`/repos/${owner}/${repo}/pulls/${pr.number}/merge`, {
            commit_title: `Auto-merge: Emergency Rollback of PR #${correlation.likelyPrNumber}`,
            merge_method: "squash",
          });
          autoMerged = true;
          console.log(`[RollbackPr] Auto-merged emergency rollback PR #${pr.number}`);
        } catch (mergeError) {
          console.error(`[RollbackPr] Auto-merge failed for PR #${pr.number}:`, mergeError);
        }
      }

      return {
        success: true,
        branchName: revertBranchName,
        prUrl: pr.html_url,
        prNumber: pr.number,
        autoMerged,
      };

    } catch (error: any) {
      console.error("[RollbackPr] Failed to execute rollback:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred during rollback",
      };
    }
  }
}

let rollbackPrSingleton: RollbackPrService | null = null;

export function getRollbackPrService(): RollbackPrService {
  if (!rollbackPrSingleton) {
    rollbackPrSingleton = new RollbackPrService();
  }
  return rollbackPrSingleton;
}
