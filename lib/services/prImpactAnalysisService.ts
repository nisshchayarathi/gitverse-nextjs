import prisma from "../../lib/prisma";
import { GitHubService } from "./githubService";
import { DependencyGraphAnalyzer } from "./dependencyGraphAnalyzer";
import { RiskScorer } from "./riskScorer";
import { GithubImpactReporter } from "./githubImpactReporter";
import { getGeminiService } from "./geminiService";
import { repositoryKnowledgeService } from "./repositoryKnowledgeService";

export class PRImpactAnalysisService {
  public static async analyzePullRequest(githubToken: string, repoFullName: string, prNumber: number, pullRequestId: number, repoId: number): Promise<void> {
    try {
      const github = new GitHubService(githubToken);
      const [owner, repo] = repoFullName.split("/");

      // 1. Fetch Diffs and Changed Files
      const files = await github.getPullRequestFiles(owner, repo, prNumber);
      if (!files || files.length === 0) return;
      
      const changedFilePaths = files.map((f: any) => f.filename);
      const diffBlocks = files.map((f: any) => `File: ${f.filename}\nPatch:\n${f.patch || 'N/A'}`).join("\n\n");

      // 2. Fetch Dependency Graph Impacts
      const impact = await DependencyGraphAnalyzer.analyzeImpact(repoFullName, changedFilePaths);

      // 3. Fetch Architecture Knowledge (Issue #1571 Integration)
      let architecturePrinciples: string[] = [];
      try {
        const knowledge = await repositoryKnowledgeService.getKnowledge(repoId);
        if (knowledge && knowledge.architecturePrinciples) {
          architecturePrinciples = JSON.parse(knowledge.architecturePrinciples as string) || [];
        }
      } catch (e) {
        console.warn("Failed to fetch repository knowledge for impact analysis:", e);
      }

      // 4. Construct AI Prompt
      const gemini = getGeminiService();
      const prompt = `You are a strict architectural and dependency analysis expert. Analyze the following Pull Request changes and identify the impact, structural drift, and risks.

Changed Files:
${changedFilePaths.join("\n")}

Downstream Dependent Files:
${impact.affectedFiles.join("\n")}

Repository Architecture Principles (if any):
${architecturePrinciples.length > 0 ? architecturePrinciples.map(p => `- ${p}`).join("\n") : "None provided."}

PR Diffs:
${diffBlocks.substring(0, 20000)} // Cap diff size

Produce a JSON output strictly conforming to the following structure:
{
  "impactSummary": "A concise summary of the PR's overall impact",
  "affectedModules": ["module1", "module2"],
  "driftWarnings": ["warning1", "warning2"], // e.g. cross-layer violations, circular dependencies, breaking architecture principles
  "dependencyRisks": ["risk1", "risk2"], // e.g. heavily depended on utilities modified
  "recommendations": ["recommendation1"] // what reviewers should focus on
}
Do not include any Markdown formatting like \`\`\`json. Return ONLY valid JSON.
`;

      const aiResponse = await gemini.chatRaw(prompt);
      let parsedAI = {
        impactSummary: "Failed to parse impact summary.",
        affectedModules: [],
        driftWarnings: [],
        dependencyRisks: [],
        recommendations: []
      };

      try {
        const cleanedJson = aiResponse.text.replace(/```json|```/g, "").trim();
        parsedAI = JSON.parse(cleanedJson);
      } catch (e) {
        console.error("Failed to parse AI impact response", e);
      }

      // 5. Calculate Risk Score
      const riskResult = RiskScorer.calculateRisk(changedFilePaths, impact, parsedAI.driftWarnings);

      // 6. Store in Database
      // We must get the headSha to uniquely identify the PR state. We can fetch it via API or just use a placeholder if not passed.
      const prDetails = await github.getPullRequest(owner, repo, prNumber);
      const headSha = prDetails?.head?.sha || `unknown-${Date.now()}`;

      await prisma.pRImpactAnalysis.upsert({
        where: { pullRequestId_headSha: { pullRequestId, headSha } },
        update: {
          riskScore: riskResult.score,
          impactSummary: parsedAI.impactSummary,
          aiMetrics: parsedAI,
          breakingChanges: parsedAI.driftWarnings.length > 0
        },
        create: {
          pullRequestId,
          headSha,
          riskScore: riskResult.score,
          impactSummary: parsedAI.impactSummary,
          aiMetrics: parsedAI,
          breakingChanges: parsedAI.driftWarnings.length > 0
        }
      });

      // 7. Post GitHub Comment
      await GithubImpactReporter.postImpactReport(githubToken, repoFullName, prNumber, {
        riskScore: riskResult.level,
        impactSummary: parsedAI.impactSummary,
        affectedModules: parsedAI.affectedModules,
        driftWarnings: parsedAI.driftWarnings,
        dependencyRisks: parsedAI.dependencyRisks,
        recommendations: parsedAI.recommendations
      });

    } catch (e) {
      console.error("PRImpactAnalysisService failed:", e);
    }
  }
}
