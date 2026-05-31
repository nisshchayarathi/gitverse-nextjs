"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedIndexer = exports.DistributedIndexer = void 0;
const repository_registry_1 = require("./repository-registry");
const org_knowledge_graph_1 = require("./org-knowledge-graph");
class DistributedIndexer {
    async indexRepository(repo) {
        console.log(`[DistributedIndexer] Indexing repository: ${repo.fullName}`);
        org_knowledge_graph_1.orgKnowledgeGraph.addNode({
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
    async indexOrganization(orgName) {
        const repos = repository_registry_1.repositoryRegistry.getAllRepositoriesForOrg(orgName);
        const results = [];
        for (const repo of repos) {
            const res = await this.indexRepository(repo);
            results.push(res);
        }
        return results;
    }
}
exports.DistributedIndexer = DistributedIndexer;
exports.distributedIndexer = new DistributedIndexer();
