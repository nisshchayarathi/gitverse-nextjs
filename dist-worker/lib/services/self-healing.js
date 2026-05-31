"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfHealingService = void 0;
const githubService_1 = require("@/lib/services/githubService");
const patch_generator_1 = require("./patch-generator");
const patch_validator_1 = require("./patch-validator");
const self_healing_1 = require("../../types/self-healing");
class SelfHealingService {
    generator = new patch_generator_1.PatchGeneratorService();
    validator = new patch_validator_1.PatchValidatorService();
    async processAndPostPatches(params) {
        const { owner, repo, pullNumber, headSha, githubToken, reviewResponse } = params;
        const github = new githubService_1.GitHubService(githubToken);
        // 1. Identify eligible issues
        const eligibleIssues = reviewResponse.issues.filter(issue => self_healing_1.SELF_HEAL_MIN_SEVERITY.includes(issue.severity) && issue.file && issue.line);
        if (eligibleIssues.length === 0) {
            return [];
        }
        const successfulPatches = [];
        // 2. Generate and validate patches
        for (const issue of eligibleIssues) {
            try {
                // We use the headSha to fetch the exact file state at the time of the review
                const fileContent = await github.getFileContent(owner, repo, issue.file, headSha);
                if (!fileContent)
                    continue;
                const generatedPatch = await this.generator.generatePatch(issue, fileContent);
                if (!generatedPatch)
                    continue;
                const validatedPatch = this.validator.validatePatch(generatedPatch, fileContent);
                if (validatedPatch.status === "valid") {
                    successfulPatches.push(validatedPatch);
                }
                else {
                    console.log(`[SelfHealing] Patch rejected for ${issue.file}:${issue.line} due to status: ${validatedPatch.status}`);
                }
            }
            catch (err) {
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
                await github.createPullRequestReviewComment(owner, repo, pullNumber, headSha, patch.file, suggestionBody, patch.endLine, patch.startLine && patch.startLine < patch.endLine ? patch.startLine : undefined);
            }
            catch (err) {
                console.error(`[SelfHealing] Failed to post suggestion to GitHub for ${patch.file}:${patch.endLine}`, err);
            }
        }
        return successfulPatches;
    }
}
exports.SelfHealingService = SelfHealingService;
