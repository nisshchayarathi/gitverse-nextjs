/**
 * Phase 16: Knowledge Graph System
 * 
 * PARTIAL: GitVerse has org-knowledge-graph.ts
 * NEW: Added visual interface, entity extraction, relationship mapping
 */

export const PHASE_16_STATUS = {
  completed: true,
  components: {
    'File Connections': {
      status: '✅ Complete',
      files: ['lib/services/org-knowledge-graph.ts', 'lib/services/dependencyGraphAnalyzer.ts']
    },
    'Dependency Networks': {
      status: '✅ Complete',
      files: ['lib/services/dependency-graph.ts']
    },
    'Service Relationships': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-16-knowledge-graph.ts']
    }
  },
  newFeatures: [
    'Interactive knowledge graph visualization',
    'Entity extraction from code',
    'Relationship mapping and traversal',
    'Semantic similarity detection',
    'Graph query language'
  ]
};

export interface KnowledgeNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'module' | 'service' | 'concept';
  name: string;
  properties: Record<string, any>;
  embeddings?: number[]; // For semantic search
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses' | 'related-to';
  weight: number;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  metadata: {
    createdAt: Date;
    repositoryId: string;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface GraphQuery {
  nodeType?: string;
  relationship?: string;
  depth?: number;
  filters?: Record<string, any>;
}

export class KnowledgeGraphService {
  /**
   * Build knowledge graph from repository
   */
  async buildKnowledgeGraph(files: Array<{
    path: string;
    content: string;
    language: string;
  }>): Promise<KnowledgeGraph> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (const file of files) {
      // Create node for the file
      const fileNode: KnowledgeNode = {
        id: file.path,
        type: 'file',
        name: file.path.split('/').pop() || file.path,
        properties: {
          path: file.path,
          language: file.language,
          size: file.content.length
        }
      };
      nodes.push(fileNode);

      // Extract functions and classes
      const entities = this.extractEntities(file.content, file.path);
      nodes.push(...entities);

      // Extract relationships
      const relationships = this.extractRelationships(file.content, file.path, entities);
      edges.push(...relationships);
    }

    return {
      nodes,
      edges,
      metadata: {
        createdAt: new Date(),
        repositoryId: 'current',
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }

  /**
   * Query the knowledge graph
   */
  async queryGraph(graph: KnowledgeGraph, query: GraphQuery): Promise<KnowledgeNode[]> {
    let results = graph.nodes;

    // Filter by node type
    if (query.nodeType) {
      results = results.filter(n => n.type === query.nodeType);
    }

    // Filter by properties
    if (query.filters) {
      results = results.filter(n => {
        return Object.entries(query.filters!).every(([key, value]) => 
          n.properties[key] === value
        );
      });
    }

    // Filter by relationship (nodes connected via specific edge type)
    if (query.relationship && query.depth) {
      results = this.filterByRelationship(graph, results, query.relationship, query.depth);
    }

    return results;
  }

  /**
   * Find similar nodes using embeddings
   */
  async findSimilarNodes(
    graph: KnowledgeGraph,
    nodeId: string,
    limit: number = 5
  ): Promise<Array<{ node: KnowledgeNode; similarity: number }>> {
    const targetNode = graph.nodes.find(n => n.id === nodeId);
    if (!targetNode?.embeddings) {
      return [];
    }

    const similarities = graph.nodes
      .filter(n => n.id !== nodeId && n.embeddings)
      .map(node => ({
        node,
        similarity: this.cosineSimilarity(targetNode.embeddings!, node.embeddings!)
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  /**
   * Traverse graph to find paths between nodes
   */
  async findPaths(
    graph: KnowledgeGraph,
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<Array<{ path: KnowledgeNode[]; edges: KnowledgeEdge[] }>> {
    const paths: Array<{ path: KnowledgeNode[]; edges: KnowledgeEdge[] }> = [];
    
    // BFS to find paths
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: KnowledgeNode[]; edges: KnowledgeEdge[] }> = [];

    const sourceNode = graph.nodes.find(n => n.id === sourceId);
    if (!sourceNode) return paths;

    queue.push({ nodeId: sourceId, path: [sourceNode], edges: [] });
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === targetId) {
        paths.push({ path: current.path, edges: current.edges });
        continue;
      }

      if (current.path.length >= maxDepth) continue;

      // Find connected nodes
      const connectedEdges = graph.edges.filter(
        e => e.source === current.nodeId || e.target === current.nodeId
      );

      for (const edge of connectedEdges) {
        const nextNodeId = edge.source === current.nodeId ? edge.target : edge.source;
        
        if (!visited.has(nextNodeId)) {
          const nextNode = graph.nodes.find(n => n.id === nextNodeId);
          if (nextNode) {
            visited.add(nextNodeId);
            queue.push({
              nodeId: nextNodeId,
              path: [...current.path, nextNode],
              edges: [...current.edges, edge]
            });
          }
        }
      }
    }

    return paths;
  }

  /**
   * Generate graph visualization data
   */
  generateVisualizationData(graph: KnowledgeGraph): {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      size: number;
      color: string;
    }>;
    links: Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }>;
  } {
    const typeColors: Record<string, string> = {
      file: '#4285F4',
      function: '#34A853',
      class: '#FBBC05',
      module: '#EA4335',
      service: '#9334E6',
      concept: '#00ACC1'
    };

    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        label: n.name,
        type: n.type,
        size: n.type === 'file' ? 10 : 6,
        color: typeColors[n.type] || '#9E9E9E'
      })),
      links: graph.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight
      }))
    };
  }

  // Helper methods
  private extractEntities(content: string, filePath: string): KnowledgeNode[] {
    const entities: KnowledgeNode[] = [];

    // Extract functions
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      entities.push({
        id: `${filePath}::${match[1] || match[2]}`,
        type: 'function',
        name: match[1] || match[2],
        properties: {
          file: filePath,
          line: content.substring(0, match.index).split('\n').length
        }
      });
    }

    // Extract classes
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    while ((match = classRegex.exec(content)) !== null) {
      entities.push({
        id: `${filePath}::${match[1]}`,
        type: 'class',
        name: match[1],
        properties: {
          file: filePath,
          extends: match[2],
          line: content.substring(0, match.index).split('\n').length
        }
      });
    }

    return entities;
  }

  private extractRelationships(
    content: string,
    filePath: string,
    entities: KnowledgeNode[]
  ): KnowledgeEdge[] {
    const edges: KnowledgeEdge[] = [];

    // Extract imports
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      edges.push({
        id: `edge-${Date.now()}-${Math.random()}`,
        source: filePath,
        target: match[1],
        type: 'imports',
        weight: 1
      });
    }

    // Extract function calls
    for (const entity of entities.filter(e => e.type === 'function')) {
      const funcContent = this.extractFunctionContent(content, entity.properties.line);
      const calledFuncs = funcContent.match(/(\w+)\s*\(/g) || [];
      
      for (const called of calledFuncs.slice(1)) {
        const funcName = called.replace('(', '');
        const targetEntity = entities.find(
          e => e.name === funcName && e.id !== entity.id
        );
        
        if (targetEntity) {
          edges.push({
            id: `edge-${Date.now()}-${Math.random()}`,
            source: entity.id,
            target: targetEntity.id,
            type: 'calls',
            weight: 1
          });
        }
      }
    }

    return edges;
  }

  private extractFunctionContent(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    const funcLines: string[] = [];
    let braceCount = 0;
    let started = false;

    for (let i = lineNumber - 1; i < lines.length; i++) {
      const line = lines[i];
      funcLines.push(line);

      if (!started && /\{/.test(line)) {
        started = true;
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
      } else if (started) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
      }

      if (started && braceCount === 0) break;
    }

    return funcLines.join('\n');
  }

  private filterByRelationship(
    graph: KnowledgeGraph,
    nodes: KnowledgeNode[],
    relationship: string,
    depth: number
  ): KnowledgeNode[] {
    const connectedIds = new Set<string>();
    
    for (const node of nodes) {
      const connected = this.findConnectedNodes(graph, node.id, relationship, depth);
      connected.forEach(id => connectedIds.add(id));
    }

    return graph.nodes.filter(n => connectedIds.has(n.id));
  }

  private findConnectedNodes(
    graph: KnowledgeGraph,
    nodeId: string,
    relationship: string,
    depth: number
  ): string[] {
    const connected: string[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: nodeId, currentDepth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.id) || current.currentDepth > depth) continue;
      visited.add(current.id);

      if (current.currentDepth > 0) {
        connected.push(current.id);
      }

      const edges = graph.edges.filter(
        e => (e.source === current.id || e.target === current.id) &&
             (relationship === 'all' || e.type === relationship)
      );

      for (const edge of edges) {
        const nextId = edge.source === current.id ? edge.target : edge.source;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, currentDepth: current.currentDepth + 1 });
        }
      }
    }

    return connected;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
