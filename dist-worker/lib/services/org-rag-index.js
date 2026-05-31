"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgRagIndex = exports.OrgRagIndex = void 0;
const org_knowledge_graph_1 = require("./org-knowledge-graph");
const repository_registry_1 = require("./repository-registry");
const githubService_1 = require("./githubService");
class OrgRagIndex {
    githubService;
    constructor(token) {
        this.githubService = new githubService_1.GitHubService(token);
    }
    async retrieveCrossRepositoryContext(repoFullName, query, maxFiles = 5) {
        console.log(`[OrgRagIndex] Retrieving cross-repo context for ${repoFullName}`);
        const downstream = org_knowledge_graph_1.orgKnowledgeGraph.getDownstreamDependents(repoFullName, 2);
        const contextFiles = [];
        for (const depId of downstream) {
            if (contextFiles.length >= maxFiles)
                break;
            const node = org_knowledge_graph_1.orgKnowledgeGraph.getNode(depId);
            if (node && node.type === 'repository') {
                const repo = repository_registry_1.repositoryRegistry.getRepository(depId);
                if (repo) {
                    try {
                        const content = await this.githubService.getFileContent(repo.owner, repo.name, "README.md");
                        if (content) {
                            contextFiles.push(`From ${depId} (README.md):\n${content.substring(0, 1000)}`);
                        }
                    }
                    catch (e) {
                        console.warn(`Failed to fetch cross-repo context from ${depId}`);
                    }
                }
            }
        }
        return contextFiles;
    }
}
exports.OrgRagIndex = OrgRagIndex;
exports.orgRagIndex = new OrgRagIndex();
