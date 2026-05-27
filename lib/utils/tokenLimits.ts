export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  lines?: number;
  language?: string;
  children?: FileNode[];
}

/**
 * Estimates the token count of a given string using the 1 token = 4 characters approximation.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Stringifies a FileNode tree into a clean, readable text representation.
 */
export function stringifyTree(tree: FileNode[], indent = ""): string {
  let result = "";
  for (const node of tree) {
    if (node.type === "directory") {
      result += `${indent}📁 ${node.name}/\n`;
      if (node.children && node.children.length > 0) {
        result += stringifyTree(node.children, indent + "  ");
      }
    } else {
      result += `${indent}📄 ${node.name} (${node.size || 0} bytes)\n`;
    }
  }
  return result;
}

/**
 * Recursively converts a flat list of file metadata into a hierarchical FileNode tree.
 */
export function buildTreeFromFiles(
  files: Array<{
    path: string;
    name: string;
    size?: number;
    lines?: number;
    language?: string | null;
  }>
): FileNode[] {
  const rootMap: Record<string, any> = {};

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = rootMap;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current[part]) {
        if (isLast) {
          current[part] = {
            node: {
              name: file.name || part,
              path: file.path,
              type: "file",
              size: file.size ?? 0,
              lines: file.lines ?? 0,
              language: file.language ?? undefined,
            } as FileNode,
          };
        } else {
          current[part] = {
            node: {
              name: part,
              path: parts.slice(0, i + 1).join("/"),
              type: "directory",
              children: [],
            } as FileNode,
          };
        }
      }
      current = current[part];
    }
  }

  function convertToTree(obj: Record<string, any>): FileNode[] {
    const nodes: FileNode[] = [];
    for (const key in obj) {
      if (key === "node") continue;
      const val = obj[key];
      const node = val.node;
      if (node.type === "directory") {
        node.children = convertToTree(val);
      }
      nodes.push(node);
    }
    // Sort directories first, then files alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  return convertToTree(rootMap);
}

/**
 * Recursively truncates a file tree to ensure its stringified representation fits within maxTokens.
 * Prunes the deepest levels first. If at depth = 1 it still exceeds maxTokens, it truncates
 * the top-level files/directories count to strictly fit.
 */
export function truncateTree(
  tree: FileNode[],
  maxTokens: number
): { truncatedTree: FileNode[]; isTruncated: boolean } {
  const originalString = stringifyTree(tree);
  if (estimateTokens(originalString) <= maxTokens) {
    return { truncatedTree: tree, isTruncated: false };
  }

  // Deep clone helper to prevent mutating the original tree
  const cloneTree = (nodes: FileNode[]): FileNode[] => {
    return nodes.map((node) => ({
      ...node,
      children: node.children ? cloneTree(node.children) : undefined,
    }));
  };

  // Helper to prune a tree to a specific maximum depth
  const pruneToDepth = (nodes: FileNode[], currentDepth: number, maxAllowedDepth: number): FileNode[] => {
    if (currentDepth >= maxAllowedDepth) {
      return []; // Strip out all children beyond the allowed depth
    }

    return nodes.map((node) => {
      if (node.type === "directory" && node.children) {
        return {
          ...node,
          children: pruneToDepth(node.children, currentDepth + 1, maxAllowedDepth),
        };
      }
      return node;
    });
  };

  // 1. Try pruning starting from a depth of 5 down to 1
  for (let depth = 5; depth >= 1; depth--) {
    const cloned = cloneTree(tree);
    const pruned = pruneToDepth(cloned, 0, depth);
    const text = stringifyTree(pruned);
    if (estimateTokens(text) <= maxTokens) {
      return { truncatedTree: pruned, isTruncated: true };
    }
  }

  // 2. If depth 1 is still too large, prune top-level items sequentially until they fit
  const topLevel = cloneTree(tree);
  const truncatedTopLevel: FileNode[] = [];
  let currentTokens = 0;

  for (const node of topLevel) {
    // For top-level directories, remove all children to fit minimally
    const minimalNode: FileNode =
      node.type === "directory" ? { ...node, children: [] } : node;

    const nodeText = stringifyTree([minimalNode]);
    const nodeTokens = estimateTokens(nodeText);

    if (currentTokens + nodeTokens <= maxTokens) {
      truncatedTopLevel.push(minimalNode);
      currentTokens += nodeTokens;
    } else {
      break;
    }
  }

  return { truncatedTree: truncatedTopLevel, isTruncated: true };
}
