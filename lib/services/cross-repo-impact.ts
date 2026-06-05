import { orgKnowledgeGraph } from "./org-knowledge-graph";
import { CrossRepoImpactReport } from "../../types/distributed-rag";

export class CrossRepoImpactService {
  analyzeImpact(modifiedRepo: string, modifiedFiles: string[]): CrossRepoImpactReport {
    const affectedRepos = new Set<string>();
    
    for (const file of modifiedFiles) {
      const nodeId = `${modifiedRepo}/${file}`;
      const downstream = orgKnowledgeGraph.getDownstreamDependents(nodeId, 3);
      downstream.forEach(dep => affectedRepos.add(dep.split('/')[0]));
    }

    const repoDownstream = orgKnowledgeGraph.getDownstreamDependents(modifiedRepo, 2);
    repoDownstream.forEach(dep => affectedRepos.add(dep.split('/')[0]));

    affectedRepos.delete(modifiedRepo);

    const affectedArray = Array.from(affectedRepos);
    
    let risk: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    if (affectedArray.length > 5) risk = 'Critical';
    else if (affectedArray.length > 2) risk = 'High';
    else if (affectedArray.length > 0) risk = 'Medium';

    let reason = "Routine changes.";
    if (modifiedFiles.some(f => f.includes('types') || f.includes('interface') || f.includes('api'))) {
      reason = "Shared types or interfaces were modified, impacting downstream consumers.";
      if (risk !== 'Critical') risk = 'High';
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

export const crossRepoImpactService = new CrossRepoImpactService();
