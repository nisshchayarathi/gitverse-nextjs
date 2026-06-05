import * as fs from "fs/promises";
import * as path from "path";
import prisma from "../prisma";
import { ComplexityLevel } from "@prisma/client";

export interface FileAnalysis {
  filePath: string;
  lines: number;
  imports: number;
  exports: number;
  classes: number;
  functions: number;
  complexity: ComplexityLevel;
  category: string;
  description: string;
}

export class FileImportanceRanker {
  /**
   * Analyze file content for metrics
   */
  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return this.analyzeContent(content, filePath);
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error}`);
    }
  }

  /**
   * Analyze file content for various metrics
   */
  private analyzeContent(content: string, filePath: string): FileAnalysis {
    const lines = content.split("\n").length;
    const imports = (content.match(/^import\s/gm) || []).length +
      (content.match(/^require\s*\(/gm) || []).length;
    const exports = (content.match(/export\s+(default\s+)?(class|function|const|type|interface)/gm) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(/g) || []).length;

    const complexity = this.determineComplexity(lines, imports, classes, functions);
    const category = this.categorizeFile(filePath, content);
    const description = this.generateDescription(filePath, category, complexity);

    return {
      filePath,
      lines,
      imports,
      exports,
      classes,
      functions,
      complexity,
      category,
      description,
    };
  }

  /**
   * Determine complexity level based on metrics
   */
  private determineComplexity(
    lines: number,
    imports: number,
    classes: number,
    functions: number,
  ): ComplexityLevel {
    // Calculate a complexity score
    let score = 0;

    // Lines of code
    if (lines > 500) score += 3;
    else if (lines > 200) score += 2;
    else if (lines > 100) score += 1;

    // Number of imports
    if (imports > 20) score += 3;
    else if (imports > 10) score += 2;
    else if (imports > 5) score += 1;

    // Number of classes and functions
    const entities = classes + functions;
    if (entities > 10) score += 3;
    else if (entities > 5) score += 2;
    else if (entities > 2) score += 1;

    if (score >= 8) return "EXPERT";
    if (score >= 6) return "ADVANCED";
    if (score >= 3) return "INTERMEDIATE";
    return "BEGINNER";
  }

  /**
   * Categorize file based on path and content
   */
  private categorizeFile(filePath: string, content: string): string {
    const lower = filePath.toLowerCase();

    // Check path patterns
    if (lower.includes("/hooks/")) return "hooks";
    if (lower.includes("/services/")) return "services";
    if (lower.includes("/utils/")) return "utilities";
    if (lower.includes("/components/")) return "components";
    if (lower.includes("/types/")) return "types";
    if (lower.includes("/api/")) return "api";
    if (lower.includes("/context/") || lower.includes("/contexts/")) return "context";
    if (lower.includes("/pages/")) return "pages";
    if (lower.includes("/routes/")) return "routes";
    if (lower.includes("/models/") || lower.includes("schema.prisma")) return "data-model";

    // Check content patterns
    if (content.includes("interface ") && content.includes("export")) return "types";
    if (content.includes("createContext") || content.includes("useContext")) return "context";
    if (content.includes("export default function") || content.includes("export const") && content.includes("React")) return "components";

    return "core";
  }

  /**
   * Generate human-readable description for a file
   */
  private generateDescription(filePath: string, category: string, complexity: ComplexityLevel): string {
    const fileName = path.basename(filePath);
    const complexityDesc = this.getComplexityDescription(complexity);

    const categoryDescriptions: Record<string, string> = {
      hooks: "React hook - reusable component logic",
      services: "Business logic and API service",
      utilities: "Helper functions and utilities",
      components: "React component for UI",
      types: "TypeScript type definitions",
      api: "API route handler",
      context: "React Context for state management",
      pages: "Page component for routing",
      routes: "Route handler",
      "data-model": "Database schema or data model",
      core: "Core functionality",
    };

    const desc = categoryDescriptions[category] || "Code module";
    return `${complexityDesc} ${desc} (${fileName})`;
  }

  /**
   * Get description for complexity level
   */
  private getComplexityDescription(level: ComplexityLevel): string {
    switch (level) {
      case "BEGINNER":
        return "Beginner-friendly";
      case "INTERMEDIATE":
        return "Intermediate-level";
      case "ADVANCED":
        return "Advanced";
      case "EXPERT":
        return "Expert-level";
      default:
        return "Standard";
    }
  }

  /**
   * Rank files by importance and save to database
   */
  async rankFilesAndSaveToDatabase(
    repositoryId: number,
    incomingDepsMap: Map<string, number>,
    outgoingDepsMap: Map<string, number>,
    sourceFiles: string[],
    baseDir: string,
  ): Promise<void> {
    for (const sourceFile of sourceFiles) {
      try {
        const analysis = await this.analyzeFile(sourceFile);
        const relativePath = path.relative(baseDir, sourceFile);

        // Calculate importance score
        const incomingDeps = incomingDepsMap.get(relativePath) || 0;
        const outgoingDeps = outgoingDepsMap.get(relativePath) || 0;

        let score = 50; // Base score

        // Add points for incoming dependencies
        score += incomingDeps * 15;

        // Add points for being a utility/service
        if (
          relativePath.includes("/utils/") ||
          relativePath.includes("/services/") ||
          relativePath.includes("index.")
        ) {
          score += 20;
        }

        // Reduce score for very complex files (they might be less suitable as learning starting points)
        if (analysis.complexity === "EXPERT") {
          score -= 10;
        }

        // Normalize to 0-100
        score = Math.min(Math.max(score, 0), 100);

        await prisma.fileImportance.upsert({
          where: {
            repositoryId_filePath: {
              repositoryId,
              filePath: relativePath,
            },
          },
          update: {
            importanceScore: score,
            incomingDeps,
            outgoingDeps,
            complexity: analysis.complexity,
            category: analysis.category,
            description: analysis.description,
          },
          create: {
            repositoryId,
            filePath: relativePath,
            fileName: path.basename(relativePath),
            importanceScore: score,
            incomingDeps,
            outgoingDeps,
            complexity: analysis.complexity,
            category: analysis.category,
            description: analysis.description,
          },
        });
      } catch (error) {
        console.error(`Error processing file ${sourceFile}:`, error);
      }
    }
  }

  /**
   * Get top N important files by category
   */
  async getImportantFilesByCategory(
    repositoryId: number,
    category?: string,
    limit: number = 10,
  ) {
    const query = category
      ? { repositoryId, category }
      : { repositoryId };

    return prisma.fileImportance.findMany({
      where: query,
      orderBy: [
        { importanceScore: "desc" },
      ],
      take: limit,
    });
  }

  /**
   * Get files by complexity level
   */
  async getFilesByComplexity(
    repositoryId: number,
    complexity: ComplexityLevel,
    limit: number = 10,
  ) {
    return prisma.fileImportance.findMany({
      where: {
        repositoryId,
        complexity,
      },
      orderBy: [
        { importanceScore: "desc" },
      ],
      take: limit,
    });
  }
}
