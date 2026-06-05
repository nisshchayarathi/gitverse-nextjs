import { KnowledgeGraphNode, CrossRepoDependency } from "../../types/distributed-rag";

export class OrgKnowledgeGraph {
  private nodes: Map<string, KnowledgeGraphNode> = new Map();
  private edges: CrossRepoDependency[] = [];

  addNode(node: KnowledgeGraphNode): void {
    this.nodes.set(node.id, node);
  }

  addDependency(dependency: CrossRepoDependency): void {
    this.edges.push(dependency);
    
    // Update node relationships
    const sourceId = `${dependency.sourceRepo}/${dependency.sourceFile}`;
    const targetId = dependency.targetFile ? `${dependency.targetRepo}/${dependency.targetFile}` : dependency.targetRepo;

    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (sourceNode && !sourceNode.dependencies.includes(targetId)) {
      sourceNode.dependencies.push(targetId);
    }
    if (targetNode && !targetNode.dependents.includes(sourceId)) {
      targetNode.dependents.push(sourceId);
    }
  }

  getNode(id: string): KnowledgeGraphNode | undefined {
    return this.nodes.get(id);
  }

  getDownstreamDependents(nodeId: string, maxDepth: number = 3): string[] {
    const affected = new Set<string>();
    const queue: Array<{ id: string, depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependents) {
          if (!affected.has(depId)) {
            affected.add(depId);
            queue.push({ id: depId, depth: depth + 1 });
          }
        }
      }
    }

    return Array.from(affected);
  }
}

export const orgKnowledgeGraph = new OrgKnowledgeGraph();
