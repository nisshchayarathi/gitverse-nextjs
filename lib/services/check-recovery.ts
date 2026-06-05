import { GitHubChecksService } from "./github-checks";
import { GitHubService } from "./githubService";

export class CheckRecoveryService {
  /**
   * Recovers a stuck check run by marking it as failed with an explanation.
   * This should be invoked in the global catch block of the webhook worker.
   */
  static async recoverStuckCheck(
    owner: string,
    repo: string,
    checkRunId: number,
    githubToken: string,
    errorObj: any
  ): Promise<void> {
    try {
      const githubService = new GitHubService(githubToken);
      const checksService = new GitHubChecksService(githubService);

      const errorMessage = errorObj instanceof Error ? errorObj.message : String(errorObj);
      
      await checksService.failCheckRun(owner, repo, checkRunId, errorMessage);
      console.log(`[CheckRecovery] Successfully recovered and failed check run ${checkRunId} for ${owner}/${repo}`);
    } catch (recoveryError) {
      console.error(`[CheckRecovery] CRITICAL: Failed to recover check run ${checkRunId}. It may be permanently pending.`, recoveryError);
    }
  }
}
