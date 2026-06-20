import { PRReviewResponse } from "@/lib/services/prReviewService";
import { GitHubService } from "@/lib/services/githubService";
import { PatchGeneratorService } from "./patch-generator";
import { PatchValidatorService } from "./patch-validator";
import { SELF_HEAL_MIN_SEVERITY, SelfHealingPatch } from "../../types/self-healing";

export class SelfHealingService {
  private generator = new PatchGeneratorService();
  private validator = new PatchValidatorService();

  async processAndPostPatches(params: {
    owner: string;
    repo: string;
    pullNumber: number;
    headSha: string;
    githubToken: string;
    reviewResponse: PRReviewResponse;
  }): Promise<SelfHealingPatch[]> {
    const { owner, repo, pullNumber, headSha, githubToken, reviewResponse } = params;
    const github = new GitHubService(githubToken);

    // 1. Identify eligible issues
    const eligibleIssues = reviewResponse.issues.filter(
      issue => SELF_HEAL_MIN_SEVERITY.includes(issue.severity) && issue.file && issue.line
    );

    if (eligibleIssues.length === 0) {
      return [];
    }

    const successfulPatches: SelfHealingPatch[] = [];

    // 2. Generate and validate patches
    for (const issue of eligibleIssues) {
      try {
        // We use the headSha to fetch the exact file state at the time of the review
        const fileContent = await github.getFileContent(owner, repo, issue.file!, headSha);
        if (!fileContent) continue;

        const generatedPatch = await this.generator.generatePatch(issue, fileContent);
        if (!generatedPatch) continue;

        const validatedPatch = this.validator.validatePatch(generatedPatch, fileContent);
        
        if (validatedPatch.status === "valid") {
          successfulPatches.push(validatedPatch);
        } else {
          console.log(`[SelfHealing] Patch rejected for ${issue.file}:${issue.line} due to status: ${validatedPatch.status}`);
        }
      } catch (err) {
        console.error(`[SelfHealing] Failed to process patch for issue ${issue.title}`, err);
      }
    }

    // 3. Post patches to GitHub
    for (const patch of successfulPatches) {
      try {
        const suggestionBody = `### GitVerse Self-Healing Analysis
**Issue:** ${patch.issue.title}
**Severity:** ${patch.issue.severity.toUpperCase()}
**Confidence:** ${patch.confidenceScore}%

${patch.explanation}

\`\`\`suggestion
${patch.suggestionBody}
\`\`\`
`;
        await github.createPullRequestReviewComment(
          owner,
          repo,
          pullNumber,
          headSha,
          patch.file,
          suggestionBody,
          patch.endLine,
          patch.startLine && patch.startLine < patch.endLine ? patch.startLine : undefined
        );
      } catch (err) {
        console.error(`[SelfHealing] Failed to post suggestion to GitHub for ${patch.file}:${patch.endLine}`, err);
      }
    }

    return successfulPatches;
  }
}
