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
    
    const MAX_DIRECTORY_DEPTH = process.env.MAX_DIRECTORY_DEPTH ? parseInt(process.env.MAX_DIRECTORY_DEPTH, 10) : 20;
    const MAX_FILES_INDEXED = process.env.MAX_FILES_INDEXED ? parseInt(process.env.MAX_FILES_INDEXED, 10) : 10000;
    const TIMEOUT_MS = process.env.TRAVERSAL_TIMEOUT_MS ? parseInt(process.env.TRAVERSAL_TIMEOUT_MS, 10) : 30000;
    
    const files: string[] = [];
    const queue: Array<{ dir: string; depth: number }> = [{ dir: repoPath, depth: 0 }];
    const visitedPaths = new Set<string>();
    const startTime = Date.now();

    while (queue.length > 0) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn(`DependencyGraphService: Traversal timeout exceeded (${TIMEOUT_MS}ms). Aborting safely.`);
        break;
      }

      if (files.length >= MAX_FILES_INDEXED) {
        console.warn(`DependencyGraphService: Max files limit reached (${MAX_FILES_INDEXED}). Stopping indexing.`);
        break;
      }

      const { dir, depth } = queue.shift()!;

      try {
        // Resolve real path to detect circular symlinks
        const realDirPath = await fs.realpath(dir);
        if (visitedPaths.has(realDirPath)) {
          console.warn(`DependencyGraphService: Circular symlink or previously visited path detected at ${dir}. Skipping.`);
          continue;
        }
        visitedPaths.add(realDirPath);
      } catch (err) {
        // Ignore realpath errors (e.g. broken symlink)
        continue;
      }

      if (depth >= MAX_DIRECTORY_DEPTH) {
        console.warn(`DependencyGraphService: Max directory depth reached at ${dir}. Skipping children.`);
        continue;
      }

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          let isDir = entry.isDirectory();
          if (entry.isSymbolicLink()) {
            try {
              const stat = await fs.stat(fullPath);
              isDir = stat.isDirectory();
            } catch {
              continue; // Broken symlink
            }
          }

          if (isDir) {
            if (!['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', 'vendor'].includes(entry.name)) {
              queue.push({ dir: fullPath, depth: depth + 1 });
            }
          } else if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(entry.name))) {
            files.push(fullPath);
          }
        }
      } catch (err) {
        // Ignore read errors for inaccessible folders
      }
    }

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
