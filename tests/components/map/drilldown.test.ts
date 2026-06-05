import { describe, it, expect } from 'vitest';
import { GraphAnalyzer, GraphAnalyzerOptions } from '@/utils/graphAnalyzer';
import { GraphFilteringService } from '@/services/graphFilteringService';

describe('GraphAnalyzer - Drilldown and Filtering', () => {
  const mockFiles = [
    { path: 'src/index.ts', lines: 10, dependencies: ['src/utils/math.ts'] },
    { path: 'src/utils/math.ts', lines: 20 },
    { path: 'package.json', lines: 5 },
    { path: 'node_modules/library/index.js', lines: 100 },
    { path: 'dist/bundle.js', lines: 500 }
  ];

  it('Scenario 1: Expand module - only top level and expanded modules are visible', () => {
    const analyzer = new GraphAnalyzer();
    const filterService = new GraphFilteringService();
    const completeGraph = analyzer.buildDependencyGraph(mockFiles);
    
    // Only root is expanded
    const options1: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root']),
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    };
    const result1 = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options1);
    
    // Expect: folder-src, file-package.json, folder-node_modules, folder-dist
    const nodes1 = result1.nodes.map(n => n.id);
    expect(nodes1).toContain('folder-src');
    expect(nodes1).toContain('file-package.json');
    expect(nodes1).toContain('folder-node_modules');
    expect(nodes1).toContain('folder-dist');
    expect(nodes1).not.toContain('file-src/index.ts');

    // Now expand src
    const options2: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root', 'folder-src']),
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    };
    const result2 = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options2);
    const nodes2 = result2.nodes.map(n => n.id);
    
    // Expect: file-src/index.ts, folder-src/utils to be visible
    expect(nodes2).toContain('folder-src');
    expect(nodes2).toContain('file-src/index.ts');
    expect(nodes2).toContain('folder-src/utils');
  });

  it('Scenario 2: Collapse module - children hidden', () => {
    const analyzer = new GraphAnalyzer();
    const filterService = new GraphFilteringService();
    const completeGraph = analyzer.buildDependencyGraph(mockFiles);
    
    // Expanded src and src/utils
    const options1: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root', 'folder-src', 'folder-src/utils']),
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    };
    const result1 = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options1);
    expect(result1.nodes.map(n => n.id)).toContain('file-src/utils/math.ts');

    // Collapse src/utils
    const options2: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root', 'folder-src']), // removed 'folder-src/utils'
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    };
    const result2 = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options2);
    expect(result2.nodes.map(n => n.id)).not.toContain('file-src/utils/math.ts');
    expect(result2.nodes.map(n => n.id)).toContain('folder-src/utils'); // folder itself is visible
  });

  it('Scenario 3: Hide node_modules - removed from graph', () => {
    const analyzer = new GraphAnalyzer();
    const filterService = new GraphFilteringService();
    const completeGraph = analyzer.buildDependencyGraph(mockFiles);

    const options: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root']),
      hiddenDirectories: ['node_modules', 'dist'],
      hiddenFileTypes: [],
      visibleDomains: []
    };
    
    const result = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options);
    const nodes = result.nodes.map(n => n.id);
    
    expect(nodes).not.toContain('folder-node_modules');
    expect(nodes).not.toContain('folder-dist');
    expect(nodes).toContain('folder-src');
  });

  it('Scenario 4: File type filter - correctly filters files', () => {
    const analyzer = new GraphAnalyzer();
    const filterService = new GraphFilteringService();
    const completeGraph = analyzer.buildDependencyGraph(mockFiles);

    // Start with src expanded so we can see files inside
    const options: GraphAnalyzerOptions = {
      expandedNodes: new Set(['root', 'folder-src']),
      hiddenDirectories: [],
      hiddenFileTypes: ['.json', '.ts'], // hide these
      visibleDomains: []
    };
    
    const result = filterService.applyFilters(completeGraph.nodes, completeGraph.links, options);
    const nodes = result.nodes.map(n => n.id);
    
    // Should hide package.json
    expect(nodes).not.toContain('file-package.json');
    // Should hide index.ts
    expect(nodes).not.toContain('file-src/index.ts');
    // Should hide math.ts
    expect(nodes).not.toContain('file-src/utils/math.ts');
  });
});
