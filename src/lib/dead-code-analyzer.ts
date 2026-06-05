export type DeadCodeFinding = {
  filePath: string;
  name: string;
  type: 'component' | 'hook' | 'utility' | 'api-route' | 'service' | 'page';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  exportLine: number;
  suggestion?: string;
};

type ExportEntry = {
  file: string;
  line: number;
  type: string;
  name: string;
};

export function analyzeDeadCode(files: Array<{ path: string; content?: string }>): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];
  const allExports: Map<string, ExportEntry> = new Map();
  const allImports: Set<string> = new Set();
  const usedInSelf: Set<string> = new Set();

  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const namedExport = line.match(/export\s+(const|function|class|interface|type|enum)\s+(\w+)/);
      if (namedExport) {
        const keyword = namedExport[1];
        const name = namedExport[2];
        let type = 'utility';
        if (keyword === 'function' && (file.path.includes('hooks') || name.startsWith('use') && name[3]?.match(/[A-Z]/))) {
          type = 'hook';
        } else if (keyword === 'class') {
          type = 'service';
        }
        allExports.set(`${file.path}:${name}`, { file: file.path, line: i + 1, type, name });

        if (type === 'hook') {
          allExports.set(name, { file: file.path, line: i + 1, type, name });
        }
      }

      const defaultExport = line.match(/export\s+default\s+(function|class|const)\s+(\w+)/);
      if (defaultExport) {
        const name = defaultExport[2];
        allExports.set(`${file.path}:${name} (default)`, {
          file: file.path,
          line: i + 1,
          type: file.path.includes('hooks') ? 'hook' : 'component',
          name,
        });
      }

      if (line.includes('export default') && !defaultExport) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && (nextLine.startsWith('function ') || nextLine.startsWith('const ') || nextLine.startsWith('class '))) {
          const inlineMatch = nextLine.match(/^(function|const|class)\s+(\w+)/);
          if (inlineMatch) {
            const name = inlineMatch[2];
            allExports.set(`${file.path}:${name} (default)`, {
              file: file.path,
              line: i + 2,
              type: 'component',
              name,
            });
          }
        }
      }

      const componentMatch = line.match(/export\s+default\s+\(?\s*\)\s*=>/);
      if (componentMatch) {
        const filename = file.path.split('/').pop()?.replace(/\.(tsx|ts|jsx|js)$/, '') || 'Unknown';
        allExports.set(`${file.path}:${filename} (default)`, {
          file: file.path,
          line: i + 1,
          type: 'component',
          name: filename,
        });
      }

      const pageExport = line.match(/export\s+default\s+function\s+(\w+)/);
      if (pageExport) {
        allExports.set(`${file.path}:${pageExport[1]} (default)`, {
          file: file.path,
          line: i + 1,
          type: file.path.includes('pages') || file.path.includes('/app/') ? 'page' : 'component',
          name: pageExport[1],
        });
      }

      const importMatches = line.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))\s+from\s+['"][^'"]+['"]/g);
      for (const im of importMatches) {
        const namedImports = im[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];
        const defaultImport = im[2];
        if (defaultImport) allImports.add(defaultImport);
        namedImports.forEach(n => {
          const clean = n.replace(/as\s+\w+/, '').trim();
          if (clean) allImports.add(clean);
        });
      }

      const dynamicImport = line.match(/import\(['"][^'"]+['"]\)/);
      if (dynamicImport) {
        allImports.add(`__dynamic_import_${file.path}_${i}`);
      }

      const usageMatches = line.matchAll(/\b(\w+)\s*\(/g);
      for (const usage of usageMatches) {
        if (usage[1]?.length >= 2) {
          usedInSelf.add(usage[1]);
        }
      }
    }
  }

  for (const [key, info] of allExports) {
    const name = info.name;
    const isImported = Array.from(allImports).some(imp => imp === name || imp.includes(name));

    if (!isImported && !name.startsWith('_')) {
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
      let reason = 'Exported but never imported in any analyzed file';
      let suggestion: string | undefined;

      if (fileIsConfig(info.file) || fileIsTest(info.file) || fileIsTypeDef(info.file)) {
        confidence = 'LOW';
        reason = 'Configuration, test, or type definition file may not need direct imports';
      }

      if (info.type === 'api-route') {
        confidence = 'MEDIUM';
        reason = 'API route may be consumed externally or by Next.js file conventions';
        suggestion = 'Check if this route is called by external services or linked in navigation';
      }

      if (info.type === 'page') {
        confidence = 'LOW';
        reason = 'Page components are often routed by the framework, not directly imported';
        suggestion = 'Verify this page is reachable through the app navigation';
      }

      if (info.type === 'hook') {
        confidence = 'MEDIUM';
        reason = 'Hook appears unused but may be called dynamically';
      }

      if (info.type === 'service') {
        suggestion = 'Consider consolidating with an existing service class';
      }

      findings.push({
        filePath: info.file,
        name,
        type: info.type as DeadCodeFinding['type'],
        confidence,
        reason,
        exportLine: info.line,
        suggestion,
      });
    }
  }

  findings.sort((a, b) => {
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.confidence] - order[b.confidence];
  });

  return findings;
}

function fileIsConfig(filePath: string): boolean {
  return /\.config\.(ts|js|mjs)$|(next|tailwind|postcss|tsconfig|jest|vitest|playwright|eslint|prettier|babel|webpack|vite|rollup)/.test(filePath);
}

function fileIsTest(filePath: string): boolean {
  return /\.(test|spec|e2e)\.(ts|tsx|js|jsx)$|__tests__|__mocks__/.test(filePath);
}

function fileIsTypeDef(filePath: string): boolean {
  return /\.d\.ts$|types\//.test(filePath);
}

export function getCleanupRecommendation(finding: DeadCodeFinding): string {
  const actions: Record<string, string[]> = {
    component: ['Remove the component file', 'Inline the component if used in only one place'],
    hook: ['Remove the hook file', 'Move logic inline if simple'],
    utility: ['Remove the export', 'Consolidate with an existing utility'],
    'api-route': ['Remove the route handler', 'Add a comment explaining external usage'],
    service: ['Remove the service class', 'Merge with another service'],
    page: ['Remove the page file', 'Redirect to an existing page'],
  };

  const recs = actions[finding.type] || ['Review and remove unused code'];
  return finding.confidence === 'HIGH'
    ? recs[0]
    : `${recs[0]} — or verify usage before removing`;
}
