import * as fs from "fs/promises";
import * as path from "path";
import prisma from "../prisma";

export interface DependencyNode {
  filePath: string;
  imports: string[];
  importCount: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // source -> targets
  incomingEdges: Map<string, Set<string>>; // target -> sources
}

export class DependencyGraphService {
  /**
   * Extract import paths from TypeScript/JavaScript files
   */
  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];

    // Match various import patterns
    const patterns = [
      // ES6 imports: import x from "module" or import x from './file'
      /import\s+(?:(?:{\s*[^}]*\s*})|[^'"\s]+)\s+from\s+['"]([^'"]+)['"]/g,
      // CommonJS requires: require("module") or require('./file')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Dynamic imports: import("module")
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // TypeScript: /// <reference path="file" />
      /\/\/\/\s*<reference\s+path\s*=\s*['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        // Filter out node_modules and external packages
        if (!this.isExternalPackage(importPath)) {
          const resolvedPath = this.resolveImportPath(importPath, filePath);
          if (resolvedPath) {
            imports.push(resolvedPath);
          }
        }
      }
    }

    return [...new Set(imports)]; // Remove duplicates
  }

  /**
   * Check if an import is an external package
   */
  private isExternalPackage(importPath: string): boolean {
    // External packages typically don't start with . or /
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      return false;
    }
    // Check for known package names (node_modules packages)
    const parts = importPath.split("/");
    const firstPart = parts[0];
    // Scoped packages start with @
    if (firstPart.startsWith("@")) {
      return true;
    }
    // Common packages
    if (!firstPart.includes(".")) {
      return true;
    }
    return false;
  }

  /**
   * Resolve import path to actual file path relative to repository root
   */
  private resolveImportPath(importPath: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);
    let resolved = path.normalize(path.join(fromDir, importPath));

    // Remove leading ./ if present
    if (resolved.startsWith("./")) {
      resolved = resolved.slice(2);
    }

    // Try different extensions
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json"];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (!candidate.includes("node_modules")) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Scan repository files and build dependency graph
   */
  async buildDependencyGraph(
    repoPath: string,
    repositoryId: number,
  ): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      incomingEdges: new Map(),
    };

    const fileExtensions = [".ts", ".tsx", ".js", ".jsx"];

    // Recursively find all source files
    const sourceFiles = await this.findSourceFiles(
      repoPath,
      fileExtensions,
    );

    // Parse each file for imports
    for (const filePath of sourceFiles) {
      try {
        const relativeFilePath = path.relative(repoPath, filePath);
        const content = await fs.readFile(filePath, "utf-8");
        const imports = this.extractImports(content, relativeFilePath);

        if (!graph.nodes.has(relativeFilePath)) {
          graph.nodes.set(relativeFilePath, {
            filePath: relativeFilePath,
            imports,
            importCount: imports.length,
          });
        }

        if (!graph.edges.has(relativeFilePath)) {
          graph.edges.set(relativeFilePath, new Set());
        }

        for (const importPath of imports) {
          graph.edges.get(relativeFilePath)!.add(importPath);

          if (!graph.incomingEdges.has(importPath)) {
            graph.incomingEdges.set(importPath, new Set());
          }
          graph.incomingEdges.get(importPath)!.add(relativeFilePath);
        }
      } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
      }
    }

    // Save to database
    await this.saveDependenciesToDatabase(repositoryId, graph);

    return graph;
  }

  /**
   * Recursively find all source files
   */
  private async findSourceFiles(
    dirPath: string,
    extensions: string[],
  ): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = [
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      "coverage",
      ".env",
    ];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            const subFiles = await this.findSourceFiles(fullPath, extensions);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Save dependencies to database
   */
  private async saveDependenciesToDatabase(
    repositoryId: number,
    graph: DependencyGraph,
  ): Promise<void> {
    for (const [sourceFile, targets] of graph.edges) {
      for (const targetFile of targets) {
        try {
          await prisma.fileDependency.upsert({
            where: {
              repositoryId_sourceFilePath_targetFilePath: {
                repositoryId,
                sourceFilePath: sourceFile,
                targetFilePath: targetFile,
              },
            },
            update: {
              occurrences: {
                increment: 1,
              },
            },
            create: {
              repositoryId,
              sourceFilePath: sourceFile,
              targetFilePath: targetFile,
              dependencyType: "import",
              occurrences: 1,
            },
          });
        } catch (error) {
          console.error(
            `Error saving dependency ${sourceFile} -> ${targetFile}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Calculate importance score for files based on dependency graph
   */
  calculateImportanceScores(graph: DependencyGraph): Map<string, number> {
    const scores = new Map<string, number>();

    for (const [filePath, node] of graph.nodes) {
      let score = 0;

      // Factor 1: Incoming dependencies (how many files depend on this)
      const incomingCount = graph.incomingEdges.get(filePath)?.size || 0;
      score += incomingCount * 20; // Weight: 20 points per incoming dependency

      // Factor 2: Centrality (files that bridge different parts)
      const outgoingCount = node.imports.length;
      if (outgoingCount > 0) {
        score += Math.min(outgoingCount, 10) * 5; // Weight: up to 50 points
      }

      // Factor 3: File characteristics
      // Core files (typically have more incoming dependencies)
      if (incomingCount > 5) {
        score += 30;
      } else if (incomingCount > 2) {
        score += 15;
      }

      // Entry files (index files, main files)
      if (
        filePath.includes("index.") ||
        filePath.includes("/main.") ||
        filePath.endsWith("App.tsx") ||
        filePath.endsWith("App.ts")
      ) {
        score += 25;
      }

      // Utility/service files
      if (filePath.includes("/utils/") || filePath.includes("/services/")) {
        score = Math.max(score, 30);
      }

      // Normalize score to 0-100
      const normalizedScore = Math.min(score, 100);
      scores.set(filePath, normalizedScore);
    }

    return scores;
  }

  /**
   * Get files ranked by importance
   */
  getRankedFiles(
    graph: DependencyGraph,
    importanceScores: Map<string, number>,
  ): Array<{ filePath: string; score: number; incomingDeps: number; outgoingDeps: number }> {
    const ranked = [];

    for (const [filePath, score] of importanceScores) {
      ranked.push({
        filePath,
        score,
        incomingDeps: graph.incomingEdges.get(filePath)?.size || 0,
        outgoingDeps: graph.edges.get(filePath)?.size || 0,
      });
    }

    // Sort by score descending
    return ranked.sort((a, b) => b.score - a.score);
  }
}
