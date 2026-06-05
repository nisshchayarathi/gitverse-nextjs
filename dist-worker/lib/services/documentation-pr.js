"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationPRService = void 0;
const githubService_1 = require("@/lib/services/githubService");
class DocumentationPRService {
    /**
     * Generates a PR for the given documentation patch.
     */
    async createPR(params) {
        const { owner, repo, filePath, patch, githubToken, repositoryDefaultBranch = "main" } = params;
        const github = new githubService_1.GitHubService(githubToken);
        try {
            // 1. Get the latest commit SHA of the default branch
            const branches = await github.getBranches(owner, repo);
            const defaultBranchInfo = branches.find(b => b.name === repositoryDefaultBranch);
            if (!defaultBranchInfo) {
                throw new Error(`Default branch ${repositoryDefaultBranch} not found.`);
            }
            const headSha = defaultBranchInfo.commit.sha;
            // 2. Create a new branch
            const timestamp = new Date().getTime();
            // Replace non-alphanumeric chars for branch name safety
            const safePath = filePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const newBranchName = `docs/auto-drift-fix-${safePath}-${timestamp}`;
            await github.createBranch(owner, repo, newBranchName, headSha);
            // 3. Create a commit on that branch
            const commitMessage = `docs: synchronize documentation with implementation for ${filePath}`;
            await github.createCommit(owner, repo, filePath, commitMessage, patch.suggestedContent, newBranchName, headSha);
            // 4. Create the Pull Request
            const prTitle = `docs: resolve documentation drift in ${filePath}`;
            const prBody = this.generatePRDescription(filePath, patch);
            const pr = await github.createPullRequest(owner, repo, prTitle, prBody, newBranchName, repositoryDefaultBranch);
            return pr.html_url;
        }
        catch (error) {
            console.error("[DocumentationPR] Failed to create PR:", error);
            return null;
        }
    }
    generatePRDescription(filePath, patch) {
        return `## Documentation Drift Report

### Files Updated
* \`${filePath}\`

### Detected Issues & Fixes
${patch.summaryOfChanges}

### Reasoning
${patch.reasoning}

### Confidence
${patch.suggestedFixConfidence}%

*Generated automatically by GitVerse Documentation Drift Detector.*
`;
    }
}
exports.DocumentationPRService = DocumentationPRService;
