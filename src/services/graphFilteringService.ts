import { GraphNode, GraphLink, GraphAnalyzerOptions } from '../utils/graphAnalyzer';

export class GraphFilteringService {
  private isHidden(path: string, options: GraphAnalyzerOptions): boolean {
    // Check hidden directories
    for (const hiddenDir of options.hiddenDirectories) {
      const parts = path.split('/');
      if (parts.includes(hiddenDir)) {
        return true;
      }
    }

    // Check hidden file types
    if (options.hiddenFileTypes && options.hiddenFileTypes.length > 0 && !path.endsWith('/')) {
      for (const ext of options.hiddenFileTypes) {
        if (path.endsWith(ext)) {
          return true;
        }
      }
    }

    // Check domains if any specified
    if (options.visibleDomains && options.visibleDomains.length > 0) {
      const rootDir = path.split('/')[0];
      if (!options.visibleDomains.includes(rootDir)) {
        return true;
      }
    }

    return false;
  }

  public applyFilters(
    completeNodes: GraphNode[],
    completeLinks: GraphLink[],
    options: GraphAnalyzerOptions
  ): { nodes: GraphNode[]; links: GraphLink[] } {
    // First, filter out completely hidden nodes
    const visibleNodesMap = new Map<string, GraphNode>();
    
    // We need a fast lookup for nodes
    const nodeByPath = new Map<string, GraphNode>();
    for (const node of completeNodes) {
      nodeByPath.set(node.path, node);
    }

    // Determine which nodes are actually visible based on `expandedNodes`
    // A node is visible if its parent folder is expanded (or it's at the root)
    const getVisibleAncestorPath = (filePath: string): string | null => {
      let current = filePath;
      while (current) {
        if (this.isHidden(current, options)) return null;

        // Is it root level?
        const lastSlash = current.lastIndexOf('/');
        if (lastSlash === -1) {
          return current; // Root level files/folders are always visible if not hidden
        }

        const parentPath = current.substring(0, lastSlash);
        const parentId = `folder-${parentPath}`;
        
        if (options.expandedNodes.has(parentId)) {
          return current; // If parent is expanded, this node is visible
        }

        // If parent is not expanded, move up to parent and check if it's visible
        current = parentPath;
      }
      return null;
    };

    // Calculate visibility and aggregated nodes
    const visiblePaths = new Set<string>();
    
    for (const node of completeNodes) {
      if (this.isHidden(node.path, options)) continue;

      const visibleAncestorPath = getVisibleAncestorPath(node.path);
      if (visibleAncestorPath) {
        visiblePaths.add(visibleAncestorPath);
      }
    }

    // Edge case for auto-expansion if there's only one root directory and it's not explicitly expanded
    // Let's identify root nodes
    const rootNodes = completeNodes.filter(n => n.path.indexOf('/') === -1 && !this.isHidden(n.path, options));
    if (rootNodes.length === 1 && rootNodes[0].type === 'folder' && !options.expandedNodes.has(rootNodes[0].id)) {
      options.expandedNodes.add(rootNodes[0].id);
      // Re-run with the auto-expanded node
      return this.applyFilters(completeNodes, completeLinks, options);
    }

    for (const path of visiblePaths) {
      const node = nodeByPath.get(path);
      if (node) {
        const isExpanded = node.type === 'folder' && options.expandedNodes.has(node.id);
        visibleNodesMap.set(node.id, {
          ...node,
          isExpanded
        });
      }
    }

    // Now aggregate links based on visible ancestors
    const aggregatedLinks: GraphLink[] = [];
    const linkSet = new Set<string>();

    const getVisibleId = (path: string): string | null => {
      const visiblePath = getVisibleAncestorPath(path);
      if (!visiblePath) return null;
      const node = nodeByPath.get(visiblePath);
      return node ? node.id : null;
    };

    for (const link of completeLinks) {
      // Look up paths from source and target IDs
      // Complete graph links should be between specific files/folders
      const sourcePath = link.source.substring(link.source.indexOf('-') + 1);
      const targetPath = link.target.substring(link.target.indexOf('-') + 1);

      const sourceVisibleId = getVisibleId(sourcePath);
      const targetVisibleId = getVisibleId(targetPath);

      if (!sourceVisibleId || !targetVisibleId) continue;

      if (sourceVisibleId !== targetVisibleId) {
        const linkId = `${sourceVisibleId}->${targetVisibleId}`;
        if (!linkSet.has(linkId)) {
          linkSet.add(linkId);
          aggregatedLinks.push({
            source: sourceVisibleId,
            target: targetVisibleId,
            strength: sourceVisibleId.startsWith('file-') ? 1 : 0.8,
            isCyclic: link.isCyclic
          });
        }
      }
    }

    return {
      nodes: Array.from(visibleNodesMap.values()),
      links: aggregatedLinks
    };
  }
}
