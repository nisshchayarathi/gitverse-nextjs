export interface GraphNode {
  id: string;
  name: string;
  type: "folder" | "file";
  size: number;
  path: string;
  depth: number;
  isExpanded?: boolean;
  hasChildren?: boolean;
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

export interface GraphAnalyzerOptions {
  expandedNodes: Set<string>;
  hiddenDirectories: string[];
  hiddenFileTypes: string[];
  visibleDomains: string[];
}

export class GraphAnalyzer {
  private maxDepth = 100;

  private isHidden(path: string, options: GraphAnalyzerOptions): boolean {
    // Check hidden directories
    for (const hiddenDir of options.hiddenDirectories) {
      const parts = path.split('/');
      if (parts.includes(hiddenDir)) {
        return true;
      }
    }

    // Check hidden file types
    if (options.hiddenFileTypes.length > 0 && !path.endsWith('/')) {
      for (const ext of options.hiddenFileTypes) {
        if (path.endsWith(ext)) {
          return true;
        }
      }
    }

    // Check domains if any specified
    if (options.visibleDomains.length > 0) {
      const rootDir = path.split('/')[0];
      if (!options.visibleDomains.includes(rootDir)) {
        return true;
      }
    }

    return false;
  }

  public buildDependencyGraph(
    files: RawFile[],
    options: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root']),
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    }
  ): { nodes: GraphNode[], links: GraphLink[] } {
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    if (!files || files.length === 0) {
      return { nodes: [], links: [] };
    }

    // Step 1: Filter raw files
    const filteredFiles = files.filter(f => !this.isHidden(f.path, options));

    // Step 2: Build hierarchy structure (Tree)
    const tree = new Map<string, { type: 'folder' | 'file', children: Set<string>, fileRef?: RawFile }>();
    
    // Virtual root
    tree.set('root', { type: 'folder', children: new Set() });

    filteredFiles.forEach(file => {
      const parts = file.path.split('/');
      
      let currentPath = '';
      let parentPath = 'root';

      for (let i = 0; i < parts.length; i++) {
        const isFile = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        
        if (!tree.has(currentPath)) {
          tree.set(currentPath, {
            type: isFile ? 'file' : 'folder',
            children: new Set(),
            fileRef: isFile ? file : undefined
          });
        }
        
        tree.get(parentPath)!.children.add(currentPath);
        parentPath = currentPath;
      }
    });

    // Step 3: Traverse based on expanded nodes to generate GraphNodes
    // We start at 'root' and only add children of expanded folders
    const queue = [{ path: 'root', depth: 0 }];
    const visiblePaths = new Set<string>();

    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      const nodeData = tree.get(path);
      if (!nodeData) continue;

      if (path !== 'root') {
        const isFolder = nodeData.type === 'folder';
        const nodeId = `${isFolder ? 'folder' : 'file'}-${path}`;
        const isExpanded = isFolder && options.expandedNodes.has(nodeId);
        
        nodesMap.set(nodeId, {
          id: nodeId,
          name: path.split('/').pop() || path,
          type: nodeData.type,
          size: nodeData.fileRef ? Math.min(Math.max((nodeData.fileRef.lines || 500) / 10, 40), 150) : 100,
          path,
          depth,
          isExpanded,
          hasChildren: isFolder && nodeData.children.size > 0
        });
        visiblePaths.add(path);
      }

      // If root, or if folder is expanded, add children to queue
      if (path === 'root' || (nodeData.type === 'folder' && options.expandedNodes.has(`folder-${path}`))) {
        for (const childPath of nodeData.children) {
          queue.push({ path: childPath, depth: depth + 1 });
        }
      }
    }

    // Edge cases for root direct children
    if (tree.get('root')?.children.size === 1 && !options.expandedNodes.has(`folder-${Array.from(tree.get('root')!.children)[0]}`)) {
       // auto expand single root directory
       const rootDir = Array.from(tree.get('root')!.children)[0];
       options.expandedNodes.add(`folder-${rootDir}`);
       // Restart graph build with this expanded
       return this.buildDependencyGraph(files, options);
    }

    // Step 4: Resolve dependencies (Links)
    // For dependencies, if a file depends on another file, but either is collapsed into a parent folder,
    // we bubble up the dependency to the visible parent folder.
    
    // Helper to find the nearest visible ancestor for any file path
    const getVisibleAncestor = (filePath: string): string | null => {
       let current = filePath;
       while (current) {
         if (visiblePaths.has(current)) {
           const type = tree.get(current)?.type === 'folder' ? 'folder' : 'file';
           return `${type}-${current}`;
         }
         const lastSlash = current.lastIndexOf('/');
         if (lastSlash === -1) break;
         current = current.substring(0, lastSlash);
       }
       return null;
    };

    const linkSet = new Set<string>();

    filteredFiles.forEach(file => {
      const sourceVisibleId = getVisibleAncestor(file.path);
      if (!sourceVisibleId) return;

      if (file.dependencies) {
        file.dependencies.forEach(dep => {
          if (this.isHidden(dep, options)) return;
          const targetVisibleId = getVisibleAncestor(dep);
          if (!targetVisibleId) return;

          if (sourceVisibleId !== targetVisibleId) {
            const linkId = `${sourceVisibleId}->${targetVisibleId}`;
            if (!linkSet.has(linkId)) {
              linkSet.add(linkId);
              links.push({
                source: sourceVisibleId,
                target: targetVisibleId,
                strength: sourceVisibleId.startsWith('file-') ? 1 : 0.8,
                isCyclic: false
              });
            }
          }
        });
      }
      
      // Implicit folder dependencies: child to parent structural links
      // Not typically done in dependency maps, but if structural links are desired we add them.
      // Let's omit structural links for now so it truly shows dependencies, or keep them if previously existed.
      // Previously: file -> parent folder. Let's add structural links to keep the tree visually cohesive.
      const lastSlash = file.path.lastIndexOf('/');
      if (lastSlash !== -1) {
         const parent = file.path.substring(0, lastSlash);
         const parentVisible = getVisibleAncestor(parent);
         if (parentVisible && parentVisible !== sourceVisibleId) {
             const linkId = `${sourceVisibleId}->${parentVisible}`;
             if (!linkSet.has(linkId)) {
                 linkSet.add(linkId);
                 links.push({
                    source: sourceVisibleId,
                    target: parentVisible,
                    strength: 0.5,
                 });
             }
         }
      }
    });

    // Safe cycle detection using Tarjan's Strongly Connected Components (SCC) algorithm.
    // This correctly identifies all nodes and edges belonging to any cycle.
    const adj = new Map<string, string[]>();
    const allNodes = new Set<string>();
    links.forEach(l => {
      allNodes.add(l.source);
      allNodes.add(l.target);
      if (!adj.has(l.source)) adj.set(l.source, []);
      adj.get(l.source)!.push(l.target);
    });

    const indexMap = new Map<string, number>();
    const lowlinkMap = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let index = 0;

    const componentIds = new Map<string, number>();
    const componentSizes = new Map<number, number>();
    let componentCounter = 0;

    const strongconnect = (u: string) => {
      indexMap.set(u, index);
      lowlinkMap.set(u, index);
      index++;
      stack.push(u);
      onStack.add(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!indexMap.has(v)) {
          strongconnect(v);
          lowlinkMap.set(u, Math.min(lowlinkMap.get(u)!, lowlinkMap.get(v)!));
        } else if (onStack.has(v)) {
          lowlinkMap.set(u, Math.min(lowlinkMap.get(u)!, indexMap.get(v)!));
        }
      }

      if (lowlinkMap.get(u) === indexMap.get(u)) {
        const componentId = componentCounter++;
        let size = 0;
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          componentIds.set(w, componentId);
          size++;
        } while (w !== u);
        componentSizes.set(componentId, size);
      }
    };

    for (const u of allNodes) {
      if (!indexMap.has(u)) {
        strongconnect(u);
      }
    }

    links.forEach(l => {
      if (l.source === l.target) {
        l.isCyclic = true;
      } else {
        const sComp = componentIds.get(l.source);
        const tComp = componentIds.get(l.target);
        l.isCyclic = sComp !== undefined && sComp === tComp && (componentSizes.get(sComp) || 0) > 1;
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links
    };
  }
}
