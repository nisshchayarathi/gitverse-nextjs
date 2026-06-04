import { RepositoryFile } from "@/types/firstPRSimulator";
import {
  CodeSnippet,
  DuplicateCluster,
  FeatureType,
  DuplicateFeature,
} from "@/types/duplicateFeature";
import { findSimilarCode } from "@/utils/similarityAnalyzer";

/**
 * Extract code snippets from files
 * Identifies distinct functions and utilities to compare
 */
export const extractCodeSnippets = (files: RepositoryFile[]): CodeSnippet[] => {
  const snippets: CodeSnippet[] = [];
  let snippetId = 0;

  files.forEach((file) => {
    if (!file.code || !/\.(tsx?|jsx?)$/.test(file.path || "")) {
      return;
    }

    const lines = file.code.split("\n");
    let inFunction = false;
    let functionStart = 0;
    let functionBody = "";
    let braceCount = 0;

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();

      // Detect function starts
      if (/^(export\s+)?(async\s+)?(function|const)\s+\w+\s*[\(=]/.test(trimmed)) {
        if (inFunction) {
          // Save previous function
          if (functionBody.trim()) {
            snippets.push({
              fileId: `${file.path}-${snippetId}`,
              fileName: file.name || "",
              filePath: file.path || "",
              startLine: functionStart,
              endLine: lineIndex,
              lineCount: lineIndex - functionStart + 1,
              code: functionBody,
              hash: hashCode(functionBody),
            });
            snippetId++;
          }
        }
        inFunction = true;
        functionStart = lineIndex;
        functionBody = line;
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (inFunction) {
        functionBody += "\n" + line;
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

        if (braceCount === 0 && /}/.test(line)) {
          // Function ended
          snippets.push({
            fileId: `${file.path}-${snippetId}`,
            fileName: file.name || "",
            filePath: file.path || "",
            startLine: functionStart,
            endLine: lineIndex,
            lineCount: lineIndex - functionStart + 1,
            code: functionBody,
            hash: hashCode(functionBody),
          });
          snippetId++;
          inFunction = false;
          functionBody = "";
        }
      }
    });

    // Handle last function if file ends
    if (inFunction && functionBody.trim()) {
      snippets.push({
        fileId: `${file.path}-${snippetId}`,
        fileName: file.name || "",
        filePath: file.path || "",
        startLine: functionStart,
        endLine: lines.length - 1,
        lineCount: lines.length - functionStart,
        code: functionBody,
        hash: hashCode(functionBody),
      });
    }
  });

  // Filter out very small snippets
  return snippets.filter((s) => s.lineCount >= 5);
};

/**
 * Simple hash function for code snippets
 */
const hashCode = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

/**
 * Detect feature type from code
 */
export const detectFeatureType = (code: string): FeatureType => {
  const lowercodeCode = code.toLowerCase();

  if (
    lowercodeCode.includes("password") ||
    lowercodeCode.includes("validate") ||
    lowercodeCode.includes("validator")
  ) {
    return "validation";
  }

  if (
    lowercodeCode.includes("auth") ||
    lowercodeCode.includes("token") ||
    lowercodeCode.includes("login")
  ) {
    return "authentication";
  }

  if (
    lowercodeCode.includes("fetch") ||
    lowercodeCode.includes("axios") ||
    lowercodeCode.includes("api") ||
    lowercodeCode.includes("request")
  ) {
    return "api-request";
  }

  if (lowercodeCode.includes("error") || lowercodeCode.includes("catch")) {
    return "error-handling";
  }

  if (
    lowercodeCode.includes("util") ||
    lowercodeCode.includes("helper") ||
    lowercodeCode.includes("format")
  ) {
    return "utility";
  }

  if (
    lowercodeCode.includes("transform") ||
    lowercodeCode.includes("map") ||
    lowercodeCode.includes("reduce")
  ) {
    return "data-transformation";
  }

  if (lowercodeCode.includes("state") || lowercodeCode.includes("store")) {
    return "state-management";
  }

  return "business-rule";
};

/**
 * Cluster similar duplicates into groups
 */
export const clusterDuplicates = (files: RepositoryFile[], threshold: number = 70) => {
  const snippets = extractCodeSnippets(files);
  if (snippets.length < 2) return [];

  const clusters: DuplicateCluster[] = [];
  const processedHashes = new Set<string>();

  snippets.forEach((snippet, index) => {
    if (!snippet.hash || processedHashes.has(snippet.hash)) return;

    const matches = findSimilarCode(snippet, snippets.slice(index + 1), threshold);

    if (matches.length > 0) {
      processedHashes.add(snippet.hash);
      matches.forEach((m) => {
        if (m.target.hash) processedHashes.add(m.target.hash);
      });

      const allInstances = [snippet, ...matches.map((m) => m.target)];
      const featureType = detectFeatureType(snippet.code || "");
      const averageSimilarity =
        matches.reduce((sum, m) => sum + m.similarity, 0) / Math.max(matches.length, 1);
      const totalLines = allInstances.reduce((sum, inst) => sum + inst.lineCount, 0);
      const potentialSavings = Math.round(totalLines * 0.65); // Estimate 65% could be extracted

      // Determine severity based on similarity and frequency
      let severity: "low" | "medium" | "high" = "low";
      if (averageSimilarity > 85 && allInstances.length > 2) {
        severity = "high";
      } else if (averageSimilarity > 75) {
        severity = "medium";
      }

      clusters.push({
        id: `cluster-${clusters.length}`,
        featureName: generateFeatureName(featureType, allInstances),
        featureType,
        description: `Found ${allInstances.length} instances of similar ${featureType} logic`,
        instances: allInstances,
        matches,
        averageSimilarity: Math.round(averageSimilarity),
        totalLines,
        potentialSavings,
        confidence: Math.min(100, Math.round((averageSimilarity * allInstances.length) / 3)),
        severity,
      });
    }
  });

  return clusters.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
};

/**
 * Generate descriptive feature name
 */
const generateFeatureName = (featureType: FeatureType, instances: CodeSnippet[]): string => {
  const typeNames: Record<FeatureType, string> = {
    validation: "Validation Logic",
    authentication: "Authentication Handler",
    "api-request": "API Request Handler",
    "error-handling": "Error Handler",
    utility: "Utility Function",
    "business-rule": "Business Logic",
    "data-transformation": "Data Transformer",
    "state-management": "State Handler",
  };

  const firstInstance = instances[0];
  const fileNameHint = firstInstance?.fileName?.replace(/\.(ts|tsx|js|jsx)$/, "") || "feature";

  return `${typeNames[featureType]} - ${fileNameHint}`;
};

/**
 * Analyze duplicate metrics
 */
export const calculateDuplicateMetrics = (clusters: DuplicateCluster[]) => {
  const allAffectedFiles = new Set<string>();
  let totalDuplicatedLines = 0;
  let totalDuplicates = 0;

  clusters.forEach((cluster) => {
    cluster.instances.forEach((inst) => {
      allAffectedFiles.add(inst.filePath);
    });
    totalDuplicatedLines += cluster.totalLines;
    totalDuplicates += cluster.instances.length;
  });

  // Estimate potential savings
  const totalReduced = clusters.reduce((sum, c) => sum + c.potentialSavings, 0);
  const totalBefore = totalDuplicatedLines;
  const potentialSavingsPercentage = totalBefore > 0 ? (totalReduced / totalBefore) * 100 : 0;

  return {
    totalClusters: clusters.length,
    totalDuplicates,
    totalAffectedFiles: allAffectedFiles.size,
    totalDuplicatedLines,
    potentialSavingsPercentage: Math.round(potentialSavingsPercentage),
    technicalDebtReduction: Math.round(
      (potentialSavingsPercentage * 0.8 +
        (clusters.filter((c) => c.severity === "high").length / Math.max(clusters.length, 1)) *
          20) /
        2
    ),
  };
};

/**
 * Identify key opportunities
 */
export const identifyOpportunities = (clusters: DuplicateCluster[]): string[] => {
  const opportunities: string[] = [];

  const highSeverity = clusters.filter((c) => c.severity === "high");
  if (highSeverity.length > 0) {
    opportunities.push(
      `Extract ${highSeverity.length} high-confidence duplicates to reduce technical debt`
    );
  }

  const validationDups = clusters.filter((c) => c.featureType === "validation");
  if (validationDups.length > 0) {
    opportunities.push(`Consolidate ${validationDups.length} validation utilities into a shared module`);
  }

  const authDups = clusters.filter((c) => c.featureType === "authentication");
  if (authDups.length > 0) {
    opportunities.push(`Create a unified authentication service to eliminate ${authDups.length} duplicates`);
  }

  const apiDups = clusters.filter((c) => c.featureType === "api-request");
  if (apiDups.length > 0) {
    opportunities.push(
      `Build an API client abstraction to handle ${apiDups.length} similar request patterns`
    );
  }

  const errorDups = clusters.filter((c) => c.featureType === "error-handling");
  if (errorDups.length > 0) {
    opportunities.push(
      `Standardize error handling across ${errorDups.length} instances using a centralized handler`
    );
  }

  return opportunities;
};
