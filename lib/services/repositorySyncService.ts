import prisma from "../../lib/prisma";
import { GitHubService } from "./githubService";
import { DependencyGraphAnalyzer } from "./dependencyGraphAnalyzer";
import { repositoryKnowledgeService } from "./repositoryKnowledgeService";
import { RepositorySyncQueue } from "./repositorySyncQueue";

export class RepositorySyncService {
  public static async processSyncJob(jobId: string, repositoryId: number, githubToken: string): Promise<void> {
    try {
      await RepositorySyncQueue.markProcessing(jobId);

      const repoRecord = await prisma.repository.findUnique({
        where: { id: repositoryId }
      });

      if (!repoRecord) {
        throw new Error("Repository not found");
      }

      const github = new GitHubService(githubToken);
      const [owner, repo] = repoRecord.url.split("/").slice(-2); // naive extract

      // 1. Fetch latest changes (Incremental push simulation)
      // Since a full commit history sync is expensive, we would theoretically just fetch the push payload diffs
      // For this implementation, we will update the repository's `lastSynchronizedAt` timestamp and fetch the latest commit SHA.
      const latestCommits = await github.getCommits(owner, repo);
      const latestSha = latestCommits[0]?.sha;

      if (!latestSha) {
        throw new Error("No commits found for repository");
      }

      // 2. Refresh Architecture Metadata
      // Sync any changes to .gitverse.json or .gitverse.md
      await repositoryKnowledgeService.refreshKnowledge(repositoryId);

      // 3. Dependency Graph Refresh
      // Assume push changes `src/index.ts`. We use the DependencyGraphAnalyzer to refresh logic.
      // (Mocking the changed files for now as we don't have the push diff payload explicitly passed in this worker step)
      const changedFilesMock = ["src/index.ts"];
      const impact = await DependencyGraphAnalyzer.analyzeImpact(`${owner}/${repo}`, changedFilesMock);

      // 4. Update Database Last Synchronized Time
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          lastSynchronizedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await RepositorySyncQueue.markCompleted(jobId);
    } catch (e: any) {
      console.error("Repository sync failed:", e);
      await RepositorySyncQueue.markFailed(jobId, e.message || String(e));
    }
  }
}
