import * as fs from "fs/promises";
import * as path from "path";
import { DependencyGraph } from "../../types/dependency-impact";

export class DependencyGraphService {
  /**
   * Builds a lightweight dependency graph by scanning TS/JS files.
   * Returns a map of File -> [Files that import it].
   */
  async buildGraph(repoPath: string): Promise<DependencyGraph> {
    const graph: DependencyGraph = new Map();
    
    // Helper to recursively find files
    const findFiles = async (dir: string, fileList: string[]) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', '.next', 'dist', 'build', 'out'].includes(entry.name)) {
              await findFiles(fullPath, fileList);
            }
          } else if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(entry.name))) {
            fileList.push(fullPath);
          }
        }
      } catch (err) {
        // Ignore read errors for inaccessible folders
      }
    };

    const files: string[] = [];
    await findFiles(repoPath, files);

    // Initialize graph keys
    const relativeFiles = files.map(f => path.relative(repoPath, f).replace(/\\/g, '/'));
    for (const rf of relativeFiles) {
      if (!graph.has(rf)) graph.set(rf, []);
    }

    const importRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/gs;

    for (let i = 0; i < files.length; i++) {
      const fullPath = files[i];
      const rf = relativeFiles[i];
      const content = await fs.readFile(fullPath, "utf-8");
      
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        let resolvedImport: string | null = null;

        // Resolve absolute alias like @/ or src/
        if (importPath.startsWith("@/")) {
          resolvedImport = importPath.replace("@/", "src/");
        } else if (importPath.startsWith("src/")) {
          resolvedImport = importPath;
        } else if (importPath.startsWith(".")) {
          // Resolve relative path
          const dir = path.dirname(rf);
          resolvedImport = path.normalize(path.join(dir, importPath)).replace(/\\/g, '/');
        }

        if (resolvedImport) {
          // Match against available files
          const potentialFiles = [
            resolvedImport,
            `${resolvedImport}.ts`,
            `${resolvedImport}.tsx`,
            `${resolvedImport}.js`,
            `${resolvedImport}.jsx`,
            `${resolvedImport}/index.ts`,
            `${resolvedImport}/index.tsx`,
            `${resolvedImport}/index.js`,
            `${resolvedImport}/index.jsx`
          ];

          for (const pf of potentialFiles) {
            if (graph.has(pf)) {
              // Add `rf` to the dependents of `pf`
              const dependents = graph.get(pf)!;
              if (!dependents.includes(rf)) {
                dependents.push(rf);
              }
              break;
            }
          }
        }
      }
    }

    return graph;
  }

  /**
   * Finds all direct and indirect dependents of the given changed files.
   * Limits traversal depth to avoid overly broad blast radius.
   */
  getDownstreamDependents(graph: DependencyGraph, changedFiles: string[], maxDepth: number = 3): string[] {
    const affected = new Set<string>();
    const queue: Array<{file: string, depth: number}> = changedFiles.map(f => ({file: f, depth: 0}));

    while (queue.length > 0) {
      const {file, depth} = queue.shift()!;
      if (depth >= maxDepth) continue;

      const dependents = graph.get(file);
      if (dependents) {
        for (const dep of dependents) {
          if (!affected.has(dep)) {
            affected.add(dep);
            queue.push({file: dep, depth: depth + 1});
          }
        }
      }
    }

    // Remove the original changed files from the affected set if they loop back
    for (const f of changedFiles) {
      affected.delete(f);
    }

    return Array.from(affected);
  }
}
