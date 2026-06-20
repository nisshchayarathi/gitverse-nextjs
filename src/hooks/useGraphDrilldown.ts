import { useState, useCallback } from 'react';

export function useGraphDrilldown() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        // Collapse: remove this node and ideally all its children
        // For simplicity, we just remove this node. The graph analyzer will stop traversal here.
        next.delete(nodeId);
      } else {
        // Expand
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback((nodes: string[]) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      nodes.forEach(n => next.add(n));
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(['root']));
  }, []);

  const setFocus = useCallback((nodeId: string | null) => {
    setFocusNode(nodeId);
    if (nodeId) {
      setHistory(prev => {
        // Avoid consecutive duplicates
        if (prev[prev.length - 1] === nodeId) return prev;
        return [...prev, nodeId];
      });
      
      // Auto-expand the focused node if it's a folder
      if (nodeId.startsWith('folder-')) {
        setExpandedNodes(prev => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
      }
    }
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) {
        setFocusNode(null);
        return [];
      }
      const nextHistory = prev.slice(0, -1);
      setFocusNode(nextHistory[nextHistory.length - 1]);
      return nextHistory;
    });
  }, []);

  const clearFocus = useCallback(() => {
    setFocusNode(null);
    setHistory([]);
  }, []);

  return {
    expandedNodes,
    toggleExpand,
    expandAll,
    collapseAll,
    focusNode,
    setFocus,
    clearFocus,
    goBack,
    canGoBack: history.length > 0
  };
}
