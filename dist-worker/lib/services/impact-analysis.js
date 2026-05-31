"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalysisService = void 0;
const dependency_graph_1 = require("./dependency-graph");
const risk_assessment_1 = require("./risk-assessment");
const pr_impact_comment_1 = require("./pr-impact-comment");
const githubService_1 = require("./githubService");
const gitService_1 = require("./gitService");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const crypto = __importStar(require("crypto"));
class ImpactAnalysisService {
    graphService = new dependency_graph_1.DependencyGraphService();
    riskService = new risk_assessment_1.RiskAssessmentService();
    commentService = new pr_impact_comment_1.PRImpactCommentService();
    async analyzePR(params) {
        const { owner, repo, pullNumber, githubToken } = params;
        const github = new githubService_1.GitHubService(githubToken);
        // 1. Fetch changed files from PR
        const prFiles = await github.getPullRequestFiles(owner, repo, pullNumber);
        // Filter to only care about source code files
        const sourceFiles = prFiles.filter(f => ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(f.filename)) &&
            f.status !== 'removed');
        if (sourceFiles.length === 0) {
            console.log("[ImpactAnalysis] No relevant source files modified in PR.");
            return;
        }
        const changedFileNames = sourceFiles.map(f => f.filename);
        const tempDir = path.join(os.tmpdir(), "gitverse-impact", `${repo}-${crypto.randomBytes(4).toString("hex")}`);
        let gitService = null;
        try {
            // 2. Clone repository shallowly to get the dependency structure
            // Note: This clones the default branch, which is sufficient for mapping existing dependencies
            const repoUrl = `https://github.com/${owner}/${repo}.git`;
            gitService = await gitService_1.GitService.cloneRepository(repoUrl, tempDir, { depth: 1 });
            // 3. Build graph
            const graph = await this.graphService.buildGraph(tempDir);
            // 4. Find dependents
            const affectedFiles = this.graphService.getDownstreamDependents(graph, changedFileNames);
            // 5. Gather file contents for Gemini from the PR itself
            const changedFilesContent = [];
            for (const f of sourceFiles) {
                // Use GitHub API to get the actual PR content (since local checkout is default branch)
                // Wait, github.getFileContent gets default branch content unless we specify the ref.
                // We will just fetch the PR diff file content by ref.
                // But since we just need to assess risk, passing the base file content or PR modified content?
                // Let's fetch using the PR branch ref.
                try {
                    const prDetails = await github.getPullRequest(owner, repo, pullNumber);
                    const prBranch = prDetails.head.ref;
                    const apiContent = await github.getFileContent(owner, repo, f.filename, prBranch);
                    if (apiContent) {
                        changedFilesContent.push({ path: f.filename, content: apiContent });
                    }
                }
                catch (e) {
                    console.warn(`[ImpactAnalysis] Failed to fetch PR content for ${f.filename}, falling back to local.`);
                    try {
                        const content = await fs.readFile(path.join(tempDir, f.filename), "utf-8");
                        changedFilesContent.push({ path: f.filename, content });
                    }
                    catch (e2) {
                        // ignore
                    }
                }
            }
            // 6. Risk Assessment
            const risk = await this.riskService.assessRisk(changedFilesContent, affectedFiles);
            // 7. Format Comment
            const report = {
                changedFiles: changedFileNames,
                potentiallyAffectedFiles: affectedFiles,
                riskLevel: risk.riskLevel,
                reasoning: risk.reasoning,
                suggestedFollowUpChecks: risk.suggestedFollowUpChecks,
                confidenceScore: risk.confidenceScore
            };
            const markdown = this.commentService.generateMarkdownReport(report);
            // 8. Post Comment
            await github.postPullRequestComment(owner, repo, pullNumber, markdown);
            console.log(`[ImpactAnalysis] Successfully posted impact report to PR #${pullNumber}`);
        }
        catch (error) {
            console.error("[ImpactAnalysis] Failed:", error);
        }
        finally {
            if (gitService) {
                await gitService.cleanup();
            }
            else {
                await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
            }
        }
    }
}
exports.ImpactAnalysisService = ImpactAnalysisService;
