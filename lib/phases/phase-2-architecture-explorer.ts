/**
 * Phase 2: Repository Architecture Explorer
 * 
 * COMPLETED: GitVerse already has comprehensive architecture visualization:
 * - D3-based dependency graph (CodeDependencyGraph.tsx)
 * - File structure tree (FileStructure.tsx)
 * - Module analysis (dependencyGraphAnalyzer.ts)
 * - Interactive visualizations (src/components/visualizations/)
 */

export const PHASE_2_STATUS = {
  completed: true,
  components: {
    'Folder Tree Analysis': {
      status: '✅ Complete',
      files: [
        'src/components/repository/FileStructure.tsx',
        'src/components/repository/ModuleSelector.tsx'
      ]
    },
    'Dependency Mapping': {
      status: '✅ Complete',
      files: [
        'lib/services/dependency-graph.ts',
        'lib/services/dependencyGraphAnalyzer.ts',
        'lib/services/dependency-risk-score.ts'
      ]
    },
    'Architecture Graph': {
      status: '✅ Complete',
      files: [
        'src/components/visualizations/CodeDependencyGraph.tsx',
        'src/components/map/AnnotationMarker.tsx',
        'src/components/map/DrilldownControls.tsx'
      ]
    }
  },
  features: [
    'Interactive D3 force-directed graph',
    'Module grouping and clustering',
    'Dependency direction indicators',
    'Zoom and pan controls',
    'Node selection and highlighting',
    'Folder importance badges',
    'File type icons'
  ],
  enhancements: [
    'Add 3D visualization option (WebGL)',
    'Add animated transitions between views',
    'Implement graph comparison mode',
    'Add export to SVG/PNG functionality'
  ]
};

export interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder' | 'module';
  importance: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  dependents: string[];
  size?: number;
  language?: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'peer';
  weight: number;
}

export interface ArchitectureGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  clusters: string[];
  hotspots: string[];
}

export class ArchitectureExplorerService {
  /**
   * Build architecture graph from repository structure
   */
  async buildArchitectureGraph(
    files: Array<{ path: string; content?: string; language?: string }>
  ): Promise<ArchitectureGraph> {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const moduleMap = new Map<string, Set<string>>();

    // Process files to create nodes
    for (const file of files) {
      const pathParts = file.path.split('/');
      const depth = pathParts.length;
      
      // Determine importance based on location and naming
      const importance = this.calculateImportance(file.path, depth);
      
      nodes.push({
        id: file.path,
        name: pathParts[pathParts.length - 1],
        path: file.path,
        type: this.determineType(file.path),
        importance,
        dependencies: [],
        dependents: [],
        language: file.language
      });

      // Group by module (folder)
      const module = pathParts.slice(0, -1).join('/') || 'root';
      if (!moduleMap.has(module)) {
        moduleMap.set(module, new Set());
      }
      moduleMap.get(module)!.add(file.path);
    }

    // Build dependency edges
    for (const node of nodes) {
      if (node.content) {
        const deps = this.extractDependencies(node.content, node.language);
        for (const dep of deps) {
          const targetNode = nodes.find(n => n.path === dep || n.name === dep);
          if (targetNode) {
            edges.push({
              source: node.id,
              target: targetNode.id,
              type: 'import',
              weight: 1
            });
            node.dependencies.push(dep);
            targetNode.dependents.push(node.id);
          }
        }
      }
    }

    return {
      nodes,
      edges,
      clusters: Array.from(moduleMap.keys()),
      hotspots: this.identifyHotspots(nodes, edges)
    };
  }

  private calculateImportance(path: string, depth: number): DependencyNode['importance'] {
    const name = path.toLowerCase();
    
    if (name.includes('index') || name.includes('main') || name.includes('app')) {
      return 'critical';
    }
    if (name.includes('config') || name.includes('.config') || name.includes('utils')) {
      return 'high';
    }
    if (depth <= 2) {
      return 'medium';
    }
    return 'low';
  }

  private determineType(path: string): DependencyNode['type'] {
    if (path.endsWith('/')) return 'folder';
    const ext = path.split('.').pop()?.toLowerCase();
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) return 'file';
    return 'module';
  }

  private extractDependencies(content: string, language?: string): string[] {
    const deps: string[] = [];
    
    // TypeScript/JavaScript imports
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    
    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"](.+?)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }

    return [...new Set(deps)];
  }

  private identifyHotspots(nodes: DependencyNode[], edges: DependencyEdge[]): string[] {
    // Nodes with many dependents are hotspots
    return nodes
      .filter(n => n.dependents.length > 5)
      .sort((a, b) => b.dependents.length - a.dependents.length)
      .slice(0, 10)
      .map(n => n.id);
  }

  /**
   * Generate module summary
   */
  async getModuleSummary(modulePath: string, graph: ArchitectureGraph): Promise<string> {
    const moduleNodes = graph.nodes.filter(n => n.path.startsWith(modulePath));
    const moduleEdges = graph.edges.filter(
      e => moduleNodes.some(n => n.id === e.source) || 
           moduleNodes.some(n => n.id === e.target)
    );

    const totalFiles = moduleNodes.length;
    const totalDependencies = moduleEdges.length;
    const avgDependencies = totalFiles > 0 ? totalDependencies / totalFiles : 0;
    const criticalFiles = moduleNodes.filter(n => n.importance === 'critical').length;

    return `
Module: ${modulePath}

Statistics:
- Total files: ${totalFiles}
- Total dependencies: ${totalDependencies}
- Average dependencies per file: ${avgDependencies.toFixed(2)}
- Critical files: ${criticalFiles}

Critical Files:
${moduleNodes.filter(n => n.importance === 'critical').map(n => `- ${n.name}`).join('\n') || 'None'}

High-traffic Files (most depended on):
${moduleNodes.sort((a, b) => b.dependents.length - a.dependents.length).slice(0, 5).map(n => `- ${n.name} (${n.dependents.length} dependents)`).join('\n')}
    `.trim();
  }
}

export const architectureExplorerService = new ArchitectureExplorerService();
