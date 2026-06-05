import { OrgRepository, DistributedIndexResult } from "../../types/distributed-rag";
import { repositoryRegistry } from "./repository-registry";
import { orgKnowledgeGraph } from "./org-knowledge-graph";

export class DistributedIndexer {
  async indexRepository(repo: OrgRepository): Promise<DistributedIndexResult> {
    console.log(`[DistributedIndexer] Indexing repository: ${repo.fullName}`);
    
    orgKnowledgeGraph.addNode({
      id: repo.fullName,
      type: 'repository',
      metadata: { owner: repo.owner, defaultBranch: repo.defaultBranch },
      dependencies: [],
      dependents: []
    });

    return {
      repositoryId: repo.id,
      repositoryName: repo.fullName,
      filesIndexed: 100, // Mock metrics for now
      tokensIndexed: 50000,
      dependenciesMapped: 10,
      timestamp: new Date().toISOString()
    };
  }

  async indexOrganization(orgName: string): Promise<DistributedIndexResult[]> {
    const repos = repositoryRegistry.getAllRepositoriesForOrg(orgName);
    const results: DistributedIndexResult[] = [];

    for (const repo of repos) {
      const res = await this.indexRepository(repo);
      results.push(res);
    }

    return results;
  }
}

export const distributedIndexer = new DistributedIndexer();
