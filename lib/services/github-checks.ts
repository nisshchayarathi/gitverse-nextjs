import { GitHubService } from "./githubService";
import { CheckConclusion, CheckOutput, CheckStatus } from "@/types/github-checks";

export class GitHubChecksService {
  constructor(private githubService: GitHubService) {}

  /**
   * Initializes a new GitVerse Check Run in the 'in_progress' state.
   * Call this immediately when a PR event is received.
   */
  async createCheckRun(
    owner: string,
    repo: string,
    headSha: string,
    name: string = "GitVerse Security & Compliance Review"
  ): Promise<number> {
    const checkRun = await this.githubService.createCheckRun(
      owner,
      repo,
      name,
      headSha,
      "in_progress"
    );
    return checkRun.id;
  }

  /**
   * Finalizes a Check Run with the given conclusion and detailed markdown output.
   */
  async completeCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    conclusion: CheckConclusion,
    output: CheckOutput
  ): Promise<void> {
    await this.githubService.updateCheckRun(
      owner,
      repo,
      checkRunId,
      "completed",
      conclusion,
      output
    );
  }

  /**
   * Transitions a Check Run to 'failure' with an 'action_required' or similar conclusion,
   * typically used when recovering from worker crashes or unexpected errors.
   */
  async failCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    errorMessage: string
  ): Promise<void> {
    await this.githubService.updateCheckRun(
      owner,
      repo,
      checkRunId,
      "completed",
      "failure",
      {
        title: "Internal Error",
        summary: "The GitVerse worker failed to complete the analysis.",
        text: `### Error Details\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\nPlease re-trigger the check by pushing a new commit or retrying from the Actions tab.`,
      }
    );
  }
}
