import { orgKnowledgeGraph } from "./org-knowledge-graph";
import { repositoryRegistry } from "./repository-registry";
import { GitHubService } from "./githubService";

export class OrgRagIndex {
  private githubService: GitHubService;

  constructor(token?: string) {
    this.githubService = new GitHubService(token);
  }

  async retrieveCrossRepositoryContext(repoFullName: string, query: string, maxFiles: number = 5): Promise<string[]> {
    console.log(`[OrgRagIndex] Retrieving cross-repo context for ${repoFullName}`);
    
    const downstream = orgKnowledgeGraph.getDownstreamDependents(repoFullName, 2);
    const contextFiles: string[] = [];
    
    for (const depId of downstream) {
      if (contextFiles.length >= maxFiles) break;
      
      const node = orgKnowledgeGraph.getNode(depId);
      if (node && node.type === 'repository') {
        const repo = repositoryRegistry.getRepository(depId);
        if (repo) {
           try {
             const content = await this.githubService.getFileContent(repo.owner, repo.name, "README.md");
             if (content) {
               contextFiles.push(`From ${depId} (README.md):\n${content.substring(0, 1000)}`);
             }
           } catch (e) {
             console.warn(`Failed to fetch cross-repo context from ${depId}`);
           }
        }
      }
    }

    return contextFiles;
  }
}

export const orgRagIndex = new OrgRagIndex();
