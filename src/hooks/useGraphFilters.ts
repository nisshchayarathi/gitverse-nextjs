import { useState, useEffect, useCallback } from 'react';

export interface GraphFilters {
  hiddenDirectories: string[];
  hiddenFileTypes: string[];
  visibleDomains: string[];
}

export function useGraphFilters() {
  const [filters, setFilters] = useState<GraphFilters>({
    hiddenDirectories: ['node_modules', 'dist', 'build', '.git', '.next', 'vendor', 'coverage'],
    hiddenFileTypes: ['.md', '.json', '.txt', '.log'],
    visibleDomains: [], // Empty means all are visible
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gitverse_graph_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFilters(prev => ({
          ...prev,
          ...parsed
        }));
      } catch (e) {
        console.warn('Failed to parse saved graph filters', e);
      }
    }
  }, []);

  // Save to localStorage when filters change
  useEffect(() => {
    localStorage.setItem('gitverse_graph_filters', JSON.stringify(filters));
  }, [filters]);

  const toggleDirectory = useCallback((dir: string) => {
    setFilters(prev => ({
      ...prev,
      hiddenDirectories: prev.hiddenDirectories.includes(dir)
        ? prev.hiddenDirectories.filter(d => d !== dir)
        : [...prev.hiddenDirectories, dir]
    }));
  }, []);

  const toggleFileType = useCallback((ext: string) => {
    setFilters(prev => ({
      ...prev,
      hiddenFileTypes: prev.hiddenFileTypes.includes(ext)
        ? prev.hiddenFileTypes.filter(e => e !== ext)
        : [...prev.hiddenFileTypes, ext]
    }));
  }, []);

  const toggleDomain = useCallback((domain: string) => {
    setFilters(prev => {
      const current = prev.visibleDomains;
      return {
        ...prev,
        visibleDomains: current.includes(domain)
          ? current.filter(d => d !== domain)
          : [...current, domain]
      };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      hiddenDirectories: ['node_modules', 'dist', 'build', '.git', '.next', 'vendor', 'coverage'],
      hiddenFileTypes: ['.md', '.json', '.txt', '.log'],
      visibleDomains: [],
    });
  }, []);

  return {
    filters,
    toggleDirectory,
    toggleFileType,
    toggleDomain,
    resetFilters
  };
}
