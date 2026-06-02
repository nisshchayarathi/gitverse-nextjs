"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokens = estimateTokens;
exports.stringifyTree = stringifyTree;
exports.buildTreeFromFiles = buildTreeFromFiles;
exports.truncateTree = truncateTree;
/**
 * Estimates the token count of a given string using the 1 token = 4 characters approximation.
 */
function estimateTokens(text) {
    if (!text)
        return 0;
    return Math.ceil(text.length / 4);
}
/**
 * Stringifies a FileNode tree into a clean, readable text representation.
 */
function stringifyTree(tree, indent = "") {
    let result = "";
    for (const node of tree) {
        if (node.type === "directory") {
            result += `${indent}📁 ${node.name}/\n`;
            if (node.children && node.children.length > 0) {
                result += stringifyTree(node.children, indent + "  ");
            }
        }
        else {
            result += `${indent}📄 ${node.name} (${node.size || 0} bytes)\n`;
        }
    }
    return result;
}
/**
 * Recursively converts a flat list of file metadata into a hierarchical FileNode tree.
 */
function buildTreeFromFiles(files) {
    const rootMap = {};
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
                        },
                    };
                }
                else {
                    current[part] = {
                        node: {
                            name: part,
                            path: parts.slice(0, i + 1).join("/"),
                            type: "directory",
                            children: [],
                        },
                    };
                }
            }
            current = current[part];
        }
    }
    function convertToTree(obj) {
        const nodes = [];
        for (const key in obj) {
            if (key === "node")
                continue;
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
function truncateTree(tree, maxTokens) {
    const originalString = stringifyTree(tree);
    if (estimateTokens(originalString) <= maxTokens) {
        return { truncatedTree: tree, isTruncated: false };
    }
    // Deep clone helper to prevent mutating the original tree
    const cloneTree = (nodes) => {
        return nodes.map((node) => ({
            ...node,
            children: node.children ? cloneTree(node.children) : undefined,
        }));
    };
    // Helper to prune a tree to a specific maximum depth
    const pruneToDepth = (nodes, currentDepth, maxAllowedDepth) => {
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
    const truncatedTopLevel = [];
    let currentTokens = 0;
    for (const node of topLevel) {
        // For top-level directories, remove all children to fit minimally
        const minimalNode = node.type === "directory" ? { ...node, children: [] } : node;
        const nodeText = stringifyTree([minimalNode]);
        const nodeTokens = estimateTokens(nodeText);
        if (currentTokens + nodeTokens <= maxTokens) {
            truncatedTopLevel.push(minimalNode);
            currentTokens += nodeTokens;
        }
        else {
            break;
        }
    }
    return { truncatedTree: truncatedTopLevel, isTruncated: true };
}
