export interface GraphNode {
  id: string;
  name: string;
  type: "folder" | "file";
  size: number;
  path: string;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
  isCyclic?: boolean;
}

export interface RawFile {
  path: string;
  lines?: number;
  size?: number;
  dependencies?: string[];
}

export class GraphAnalyzer {
  private maxDepth = 100;

  public buildDependencyGraph(files: RawFile[]): { nodes: GraphNode[], links: GraphLink[] } {
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    if (!files || files.length === 0) {
      return { nodes: [], links: [] };
    }

    // Process files (limit to top 30 to avoid clutter)
    const topFiles = [...files]
      .sort((a, b) => (b.lines || 0) - (a.lines || 0))
      .slice(0, 30);

    const folderPaths = new Set<string>();

    topFiles.forEach((file) => {
      const parts = file.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join("/"));
      }
    });

    // Create folder nodes
    folderPaths.forEach((path) => {
      const name = path.split("/").pop() || path;
      nodesMap.set(`folder-${path}`, {
        id: `folder-${path}`,
        name,
        type: "folder",
        size: 100,
        path,
      });
    });

    // Create file nodes
    topFiles.forEach((file) => {
      const name = file.path.split("/").pop() || file.path;
      nodesMap.set(`file-${file.path}`, {
        id: `file-${file.path}`,
        name,
        type: "file",
        size: Math.min(Math.max((file.lines || 500) / 10, 40), 150),
        path: file.path,
      });
    });

    const adjacencyList = new Map<string, string[]>();

    const addEdge = (source: string, target: string) => {
      if (!adjacencyList.has(source)) adjacencyList.set(source, []);
      adjacencyList.get(source)!.push(target);
    };

    // Map parent relationships and explicit dependencies
    topFiles.forEach((file) => {
      const parts = file.path.split("/");
      if (parts.length > 1) {
        const parentFolder = parts.slice(0, -1).join("/");
        addEdge(`file-${file.path}`, `folder-${parentFolder}`);
      }

      if (file.dependencies) {
        file.dependencies.forEach((dep) => {
          addEdge(`file-${file.path}`, `file-${dep}`);
        });
      }
    });

    folderPaths.forEach((path) => {
      const parts = path.split("/");
      if (parts.length > 1) {
        const parentFolder = parts.slice(0, -1).join("/");
        if (folderPaths.has(parentFolder)) {
          addEdge(`folder-${path}`, `folder-${parentFolder}`);
        }
      }
    });

    // SAFE GRAPH TRAVERSAL WITH CYCLE DETECTION
    // Using visited set and recursion stack tracking to avoid 'Maximum call stack size exceeded'
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const traverseDependencies = (nodeId: string, depth: number) => {
      if (depth > this.maxDepth) {
        console.warn(`[GraphAnalyzer] Max depth ${this.maxDepth} reached at node ${nodeId}. Terminating branch safely.`);
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (recursionStack.has(neighbor)) {
          // Circular dependency detected
          console.info(`[GraphAnalyzer] Circular dependency safely visualized: ${nodeId} -> ${neighbor}`);
          links.push({
            source: nodeId,
            target: neighbor,
            strength: 0.5,
            isCyclic: true,
          });
        } else {
          links.push({
            source: nodeId,
            target: neighbor,
            strength: nodeId.startsWith("file-") ? 1 : 0.8,
            isCyclic: false,
          });
          
          if (!visited.has(neighbor)) {
            traverseDependencies(neighbor, depth + 1);
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    // Initiate traversal
    for (const nodeId of nodesMap.keys()) {
      if (!visited.has(nodeId)) {
        traverseDependencies(nodeId, 0);
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  }
}
