"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgKnowledgeGraph = exports.OrgKnowledgeGraph = void 0;
class OrgKnowledgeGraph {
    nodes = new Map();
    edges = [];
    addNode(node) {
        this.nodes.set(node.id, node);
    }
    addDependency(dependency) {
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
    getNode(id) {
        return this.nodes.get(id);
    }
    getDownstreamDependents(nodeId, maxDepth = 3) {
        const affected = new Set();
        const queue = [{ id: nodeId, depth: 0 }];
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            if (depth >= maxDepth)
                continue;
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
exports.OrgKnowledgeGraph = OrgKnowledgeGraph;
exports.orgKnowledgeGraph = new OrgKnowledgeGraph();
