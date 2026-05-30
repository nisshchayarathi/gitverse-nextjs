import { DependencyGraphService } from "./dependency-graph";
import { RiskAssessmentService } from "./risk-assessment";
import { PRImpactCommentService } from "./pr-impact-comment";
import { GitHubService } from "./githubService";
import { GitService } from "./gitService";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";

export class ImpactAnalysisService {
  private graphService = new DependencyGraphService();
  private riskService = new RiskAssessmentService();
  private commentService = new PRImpactCommentService();

  async analyzePR(params: {
    owner: string;
    repo: string;
    pullNumber: number;
    githubToken: string;
  }): Promise<void> {
    const { owner, repo, pullNumber, githubToken } = params;
    const github = new GitHubService(githubToken);

    // 1. Fetch changed files from PR
    const prFiles = await github.getPullRequestFiles(owner, repo, pullNumber);
    
    // Filter to only care about source code files
    const sourceFiles = prFiles.filter(f => 
      ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(f.filename)) &&
      f.status !== 'removed'
    );

    if (sourceFiles.length === 0) {
      console.log("[ImpactAnalysis] No relevant source files modified in PR.");
      return;
    }

    const changedFileNames = sourceFiles.map(f => f.filename);

    const tempDir = path.join(
      os.tmpdir(),
      "gitverse-impact",
      `${repo}-${crypto.randomBytes(4).toString("hex")}`
    );

    let gitService: GitService | null = null;
    try {
      // 2. Clone repository shallowly to get the dependency structure
      // Note: This clones the default branch, which is sufficient for mapping existing dependencies
      const repoUrl = `https://github.com/${owner}/${repo}.git`;
      gitService = await GitService.cloneRepository(repoUrl, tempDir, { depth: 1 });

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
        } catch (e) {
           console.warn(`[ImpactAnalysis] Failed to fetch PR content for ${f.filename}, falling back to local.`);
           try {
              const content = await fs.readFile(path.join(tempDir, f.filename), "utf-8");
              changedFilesContent.push({ path: f.filename, content });
           } catch(e2) {
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

    } catch (error) {
      console.error("[ImpactAnalysis] Failed:", error);
    } finally {
      if (gitService) {
        await gitService.cleanup();
      } else {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
      }
    }
  }
}
