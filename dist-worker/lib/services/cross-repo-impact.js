"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crossRepoImpactService = exports.CrossRepoImpactService = void 0;
const org_knowledge_graph_1 = require("./org-knowledge-graph");
class CrossRepoImpactService {
    analyzeImpact(modifiedRepo, modifiedFiles) {
        const affectedRepos = new Set();
        for (const file of modifiedFiles) {
            const nodeId = `${modifiedRepo}/${file}`;
            const downstream = org_knowledge_graph_1.orgKnowledgeGraph.getDownstreamDependents(nodeId, 3);
            downstream.forEach(dep => affectedRepos.add(dep.split('/')[0]));
        }
        const repoDownstream = org_knowledge_graph_1.orgKnowledgeGraph.getDownstreamDependents(modifiedRepo, 2);
        repoDownstream.forEach(dep => affectedRepos.add(dep.split('/')[0]));
        affectedRepos.delete(modifiedRepo);
        const affectedArray = Array.from(affectedRepos);
        let risk = 'Low';
        if (affectedArray.length > 5)
            risk = 'Critical';
        else if (affectedArray.length > 2)
            risk = 'High';
        else if (affectedArray.length > 0)
            risk = 'Medium';
        let reason = "Routine changes.";
        if (modifiedFiles.some(f => f.includes('types') || f.includes('interface') || f.includes('api'))) {
            reason = "Shared types or interfaces were modified, impacting downstream consumers.";
            if (risk !== 'Critical')
                risk = 'High';
        }
        return {
            modifiedRepository: modifiedRepo,
            potentiallyAffectedRepositories: affectedArray,
            risk,
            reason,
            details: [
                `Analyzed ${modifiedFiles.length} files.`,
                `Found ${affectedArray.length} downstream repositories.`
            ]
        };
    }
}
exports.CrossRepoImpactService = CrossRepoImpactService;
exports.crossRepoImpactService = new CrossRepoImpactService();
