import { GraphAnalyzer } from '../graphAnalyzer';

describe('src/utils/graphAnalyzer', () => {
  it('builds a dependency graph with cycle detection', () => {
    const analyzer = new GraphAnalyzer();

    const files = [
      {
        path: 'src/a.ts',
        lines: 120,
        dependencies: ['src/b.ts'],
      },
      {
        path: 'src/b.ts',
        lines: 80,
        dependencies: ['src/a.ts'],
      },
      {
        path: 'src/nested/c.ts',
        lines: 60,
      },
    ];

    const { nodes, links } = analyzer.buildDependencyGraph(files);

    expect(nodes.some((n) => n.id === 'file-src/a.ts')).toBe(true);
    expect(nodes.some((n) => n.id === 'file-src/b.ts')).toBe(true);
    expect(nodes.some((n) => n.id === 'file-src/nested/c.ts')).toBe(true);
    expect(nodes.some((n) => n.id === 'folder-src')).toBe(true);
    expect(nodes.some((n) => n.id === 'folder-src/nested')).toBe(true);
    expect(links.some((l) => l.isCyclic === true)).toBe(true);
  });

  it('handles empty files array', () => {
    const analyzer = new GraphAnalyzer();
    const { nodes, links } = analyzer.buildDependencyGraph([]);
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('handles undefined files input', () => {
    const analyzer = new GraphAnalyzer();
    const { nodes, links } = analyzer.buildDependencyGraph(undefined as any);
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('limits files to top 30 by line count', () => {
    const analyzer = new GraphAnalyzer();
    const files = Array.from({ length: 50 }, (_, i) => ({
      path: `src/file${i}.ts`,
      lines: 100 - i,
    }));
    const { nodes } = analyzer.buildDependencyGraph(files);
    const fileNodes = nodes.filter((n) => n.type === 'file');
    expect(fileNodes.length).toBeLessThanOrEqual(30);
  });

  it('handles deeply nested paths correctly', () => {
    const analyzer = new GraphAnalyzer();
    const files = [
      { path: 'a/b/c/d/e/deep.ts', lines: 50 },
    ];
    const { nodes } = analyzer.buildDependencyGraph(files);
    const folderIds = nodes.filter((n) => n.type === 'folder').map((n) => n.id);
    expect(folderIds).toContain('folder-a');
    expect(folderIds).toContain('folder-a/b');
    expect(folderIds).toContain('folder-a/b/c');
    expect(folderIds).toContain('folder-a/b/c/d');
  });

  it('handles files with no dependencies', () => {
    const analyzer = new GraphAnalyzer();
    const files = [
      { path: 'standalone.ts', lines: 100 },
      { path: 'another.ts', lines: 50 },
    ];
    const { nodes, links } = analyzer.buildDependencyGraph(files);
    expect(nodes.length).toBeGreaterThan(0);
    expect(links.every((l) => !l.isCyclic)).toBe(true);
  });

  it('handles files with self-dependencies', () => {
    const analyzer = new GraphAnalyzer();
    const files = [
      { path: 'self.ts', lines: 100, dependencies: ['self.ts'] },
    ];
    const { links } = analyzer.buildDependencyGraph(files);
    const selfLinks = links.filter((l) => l.source === 'file-self.ts' && l.target === 'file-self.ts');
    expect(selfLinks.length).toBeGreaterThan(0);
  });
});

