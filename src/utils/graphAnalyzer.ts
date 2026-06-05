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
  public buildDependencyGraph(
    files: RawFile[]
  ): { nodes: GraphNode[], links: GraphLink[] } {
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    if (!files || files.length === 0) {
      return { nodes: [], links: [] };
    }

    // Step 1: Build hierarchy structure (Tree)
    const tree = new Map<string, { type: 'folder' | 'file', children: Set<string>, fileRef?: RawFile }>();
    
    // Virtual root
    tree.set('root', { type: 'folder', children: new Set() });

    files.forEach(file => {
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

    // Step 2: Traverse tree to generate all GraphNodes
    const queue = [{ path: 'root', depth: 0 }];

    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      const nodeData = tree.get(path);
      if (!nodeData) continue;

      if (path !== 'root') {
        const isFolder = nodeData.type === 'folder';
        const nodeId = `${isFolder ? 'folder' : 'file'}-${path}`;
        
        nodesMap.set(nodeId, {
          id: nodeId,
          name: path.split('/').pop() || path,
          type: nodeData.type,
          size: nodeData.fileRef ? Math.min(Math.max((nodeData.fileRef.lines || 500) / 10, 40), 150) : 100,
          path,
          depth,
          isExpanded: false, // UI filter will determine this
          hasChildren: isFolder && nodeData.children.size > 0
        });
      }

      // Process all children to build the COMPLETE graph
      for (const childPath of nodeData.children) {
        queue.push({ path: childPath, depth: depth + 1 });
      }
    }

    // Step 3: Resolve dependencies (Links)
    // We build links directly between files. UI filtering will aggregate them later.
    const linkSet = new Set<string>();

    files.forEach(file => {
      const sourceId = `file-${file.path}`;

      if (file.dependencies) {
        file.dependencies.forEach(dep => {
          const targetId = `file-${dep}`;
          // Only add link if target node exists (valid dependency)
          if (nodesMap.has(targetId) && sourceId !== targetId) {
            const linkId = `${sourceId}->${targetId}`;
            if (!linkSet.has(linkId)) {
              linkSet.add(linkId);
              links.push({
                source: sourceId,
                target: targetId,
                strength: 1,
                isCyclic: false
              });
            }
          }
        });
      }
      
      // Structural links: file to parent folder
      const lastSlash = file.path.lastIndexOf('/');
      if (lastSlash !== -1) {
         const parent = file.path.substring(0, lastSlash);
         const parentId = `folder-${parent}`;
         if (nodesMap.has(parentId) && parentId !== sourceId) {
             const linkId = `${sourceId}->${parentId}`;
             if (!linkSet.has(linkId)) {
                 linkSet.add(linkId);
                 links.push({
                    source: sourceId,
                    target: parentId,
                    strength: 0.5,
                 });
             }
         }
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links
    };
  }
}
