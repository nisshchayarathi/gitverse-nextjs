"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueTriageService = void 0;
const githubService_1 = require("@/lib/services/githubService");
const issue_classifier_1 = require("@/lib/services/issue-classifier");
const issue_complexity_1 = require("@/lib/services/issue-complexity");
const issue_file_matcher_1 = require("@/lib/services/issue-file-matcher");
class IssueTriageService {
    classifier;
    complexity;
    fileMatcher;
    constructor() {
        this.classifier = new issue_classifier_1.IssueClassifierService();
        this.complexity = new issue_complexity_1.IssueComplexityService();
        this.fileMatcher = new issue_file_matcher_1.IssueFileMatcherService();
    }
    /**
     * Orchestrates the triage process for an issue.
     */
    async triageIssue(params) {
        const { owner, repo, issueNumber, title, body, repositoryFiles, githubToken } = params;
        // 1. Analyze in parallel
        const [classification, complexity, relevantFiles] = await Promise.all([
            this.classifier.classifyIssue(title, body),
            this.complexity.estimateComplexity(title, body),
            this.fileMatcher.matchFiles(title, body, repositoryFiles),
        ]);
        // Construct the suggested investigation path based on findings
        const suggestedInvestigationPath = relevantFiles.length > 0
            ? `Start by reviewing ${relevantFiles[0].path}. This file appears to be central to the issue. Follow the logic and references from there.`
            : `Start by reproducing the issue based on the description to identify the affected area in the codebase.`;
        const result = {
            classification,
            complexity,
            relevantFiles,
            suggestedInvestigationPath,
        };
        // 2. Perform GitHub actions
        const github = new githubService_1.GitHubService(githubToken);
        try {
            // 2a. Add labels
            const existingLabels = await github.getRepoLabels(owner, repo);
            const repoLabelNames = new Set(existingLabels.map(l => l.name.toLowerCase()));
            const labelsToAdd = new Set();
            // Only add category if it exists in repo
            if (repoLabelNames.has(classification.category)) {
                labelsToAdd.add(classification.category);
            }
            else {
                // Fallback for common categories if they exist with slightly different names
                const categoryMap = {
                    bug: ["bug", "defect"],
                    enhancement: ["enhancement", "feature", "feature request"],
                    documentation: ["documentation", "docs"],
                };
                const fallbacks = categoryMap[classification.category];
                if (fallbacks) {
                    for (const fb of fallbacks) {
                        if (repoLabelNames.has(fb)) {
                            labelsToAdd.add(fb);
                            break;
                        }
                    }
                }
            }
            // Add tags if they exist
            for (const tag of classification.tags) {
                if (repoLabelNames.has(tag.toLowerCase())) {
                    labelsToAdd.add(tag.toLowerCase());
                }
            }
            if (labelsToAdd.size > 0) {
                await github.addIssueLabels(owner, repo, issueNumber, Array.from(labelsToAdd));
            }
            // 2b. Post comment
            const comment = this.formatGuidanceComment(result);
            await github.postIssueComment(owner, repo, issueNumber, comment);
        }
        catch (error) {
            console.error("[IssueTriageService] Failed to perform GitHub actions:", error);
            // We still return the result even if GH actions fail
        }
        return result;
    }
    formatGuidanceComment(result) {
        const { classification, complexity, relevantFiles, suggestedInvestigationPath } = result;
        // Capitalize category
        const categoryName = classification.category.charAt(0).toUpperCase() + classification.category.slice(1);
        const difficultyText = complexity.contributorDifficulty
            ? `(${complexity.contributorDifficulty})`
            : "";
        const beginnerText = complexity.beginnerFriendly
            ? "🌱 **Beginner Friendly!** Great for first-time contributors."
            : "";
        let fileList = "No specific files identified.";
        if (relevantFiles.length > 0) {
            fileList = relevantFiles.map((f) => `- \`${f.path}\` (${f.reasoning})`).join("\n");
        }
        // Determine an overall confidence average
        const overallConfidence = Math.round((classification.confidence + complexity.confidence) / 2);
        return `### GitVerse Smart Issue Analysis

**Detected Type**
${categoryName} ${classification.tags.length > 0 ? `(${classification.tags.join(', ')})` : ''}

**Estimated Complexity**
${complexity.complexity} ${difficultyText}
${beginnerText}

**Likely Files to Review**
${fileList}

**Suggested Investigation Path**
${suggestedInvestigationPath}

*Confidence: ${overallConfidence}%*
`;
    }
}
exports.IssueTriageService = IssueTriageService;
