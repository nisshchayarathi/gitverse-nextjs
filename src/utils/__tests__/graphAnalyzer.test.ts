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

    // File nodes
    expect(nodes.some((n) => n.id === 'file-src/a.ts')).toBe(true);
    expect(nodes.some((n) => n.id === 'file-src/b.ts')).toBe(true);
    expect(nodes.some((n) => n.id === 'file-src/nested/c.ts')).toBe(true);

    // Folder nodes
    expect(nodes.some((n) => n.id === 'folder-src')).toBe(true);
    expect(nodes.some((n) => n.id === 'folder-src/nested')).toBe(true);

    // Should include at least one cyclic link for the a<->b dependency
    expect(links.some((l) => l.isCyclic === true)).toBe(true);
  });
});

