import { RepositoryFile } from "@/types/firstPRSimulator";
import { CodeSnippet, SimilarityMatch, SimilarityAnalysisMetrics } from "@/types/duplicateFeature";

/**
 * Calculate Levenshtein distance between two strings
 * Measures the edit distance between strings for similarity
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array(n + 1)
    .fill(0)
    .map(() => Array(m + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[0][i] = i;
  for (let j = 0; j <= n; j++) dp[j][0] = j;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[j][i] = dp[j - 1][i - 1];
      } else {
        dp[j][i] = Math.min(dp[j - 1][i - 1] + 1, dp[j][i - 1] + 1, dp[j - 1][i] + 1);
      }
    }
  }

  return dp[n][m];
};

/**
 * Convert Levenshtein distance to similarity percentage
 */
export const distanceToSimilarity = (distance: number, maxLength: number): number => {
  if (maxLength === 0) return 100;
  return Math.max(0, ((maxLength - distance) / maxLength) * 100);
};

/**
 * Extract common identifiers from code
 * Used for dependency similarity analysis
 */
export const extractIdentifiers = (code: string): Set<string> => {
  const identifiers = new Set<string>();

  // Match common patterns: function names, variable names, imports
  const patterns = [
    /function\s+(\w+)/g, // function declarations
    /const\s+(\w+)\s*=/g, // const declarations
    /let\s+(\w+)\s*=/g, // let declarations
    /var\s+(\w+)\s*=/g, // var declarations
    /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, // imports
    /(\w+)\s*\(/g, // function calls
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) {
        identifiers.add(match[1].toLowerCase());
      }
    }
  });

  return identifiers;
};

/**
 * Calculate AST (Abstract Syntax Tree) similarity
 * Simplified AST comparison based on structural patterns
 */
export const calculateASTSimilarity = (code1: string, code2: string): number => {
  // Remove whitespace and normalize
  const normalize = (code: string) =>
    code
      .replace(/\s+/g, " ")
      .replace(/[{}();]/g, " $& ")
      .toLowerCase()
      .trim();

  const normalized1 = normalize(code1);
  const normalized2 = normalize(code2);

  if (normalized1 === normalized2) return 100;

  const maxLen = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);

  return Math.max(0, ((maxLen - distance) / maxLen) * 100);
};

/**
 * Extract function signatures
 * Analyzes function parameters and structure
 */
export const extractFunctionSignature = (code: string): string => {
  const match = code.match(/function\s+\w+\s*\((.*?)\)|const\s+\w+\s*=\s*\((.*?)\)|const\s+\w+\s*=\s*function\s*\((.*?)\)/);

  if (match) {
    // Extract parameters
    const params = (match[1] || match[2] || match[3] || "").split(",");
    return params.map((p) => p.trim().split(":")[0]).join(",");
  }

  return "";
};

/**
 * Calculate function signature similarity
 */
export const calculateSignatureSimilarity = (sig1: string, sig2: string): number => {
  if (sig1 === sig2) return 100;

  const params1 = sig1.split(",").filter(Boolean);
  const params2 = sig2.split(",").filter(Boolean);

  if (params1.length !== params2.length) {
    return (Math.min(params1.length, params2.length) / Math.max(params1.length, params2.length)) *
      50; // Max 50% if param count differs
  }

  let matches = 0;
  params1.forEach((p1, i) => {
    if (p1 === params2[i]) matches++;
  });

  return (matches / params1.length) * 100;
};

/**
 * Calculate dependency similarity
 * Compares imported modules and dependencies
 */
export const calculateDependencySimilarity = (
  identifiers1: Set<string>,
  identifiers2: Set<string>
): number => {
  if (identifiers1.size === 0 && identifiers2.size === 0) return 100;
  if (identifiers1.size === 0 || identifiers2.size === 0) return 0;

  let common = 0;
  identifiers1.forEach((id) => {
    if (identifiers2.has(id)) common++;
  });

  const union = new Set([...identifiers1, ...identifiers2]).size;
  return (common / union) * 100; // Jaccard similarity
};

/**
 * Extract common code patterns
 * Identifies repeated logic structures
 */
export const extractPatterns = (code: string): string[] => {
  const patterns: string[] = [];

  // Common patterns to detect
  if (/if\s*\(\s*[!]?\s*\w+\s*\)\s*{/.test(code)) {
    patterns.push("conditional-logic");
  }
  if (/for\s*\(|while\s*\(|forEach/.test(code)) {
    patterns.push("iteration");
  }
  if (/throw\s+new|catch\s*\(/.test(code)) {
    patterns.push("error-handling");
  }
  if (/async\s+|await\s+|\.then\(/.test(code)) {
    patterns.push("async-operations");
  }
  if (/\w+\s*\?\s*\w+\s*:\s*\w+/.test(code)) {
    patterns.push("ternary-operators");
  }
  if (/\.\w+\(\s*\)/.test(code)) {
    patterns.push("method-calls");
  }
  if (/\[\s*\.\.\.\s*/.test(code)) {
    patterns.push("spread-operator");
  }
  if (/=>|function/.test(code)) {
    patterns.push("function-definition");
  }

  return patterns;
};

/**
 * Calculate pattern similarity
 */
export const calculatePatternSimilarity = (patterns1: string[], patterns2: string[]): number => {
  if (patterns1.length === 0 && patterns2.length === 0) return 100;
  if (patterns1.length === 0 || patterns2.length === 0) return 0;

  const set1 = new Set(patterns1);
  const set2 = new Set(patterns2);

  let common = 0;
  set1.forEach((p) => {
    if (set2.has(p)) common++;
  });

  return (common / Math.max(set1.size, set2.size)) * 100;
};

/**
 * Comprehensive similarity analysis
 * Combines multiple metrics into a single score
 */
export const analyzeSimilarity = (
  code1: string,
  code2: string
): SimilarityAnalysisMetrics => {
  const astSimilarity = calculateASTSimilarity(code1, code2);

  const sig1 = extractFunctionSignature(code1);
  const sig2 = extractFunctionSignature(code2);
  const nameDistance = levenshteinDistance(sig1, sig2);

  const ids1 = extractIdentifiers(code1);
  const ids2 = extractIdentifiers(code2);
  const dependencySimilarity = calculateDependencySimilarity(ids1, ids2);

  const patterns1 = extractPatterns(code1);
  const patterns2 = extractPatterns(code2);
  const patternSimilarity = calculatePatternSimilarity(patterns1, patterns2);

  // Weighted average
  const overallScore = (astSimilarity * 0.4 +
    (100 - Math.min(nameDistance / Math.max(sig1.length, sig2.length, 1) * 100, 100)) * 0.2 +
    dependencySimilarity * 0.2 +
    patternSimilarity * 0.2) as number;

  return {
    astSimilarity: Math.round(astSimilarity),
    nameDistance,
    dependencySimilarity: Math.round(dependencySimilarity),
    patternSimilarity: Math.round(patternSimilarity),
    overallScore: Math.round(Math.max(0, Math.min(100, overallScore))),
  };
};

/**
 * Find potential duplicates between two code snippets
 */
export const findSimilarCode = (
  source: CodeSnippet,
  targets: CodeSnippet[],
  threshold: number = 70
): SimilarityMatch[] => {
  const matches: SimilarityMatch[] = [];

  if (!source.code) return matches;

  targets.forEach((target) => {
    if (!target.code || target.fileId === source.fileId) return;

    const metrics = analyzeSimilarity(source.code!, target.code);

    if (metrics.overallScore >= threshold) {
      const ids1 = extractIdentifiers(source.code!);
      const ids2 = extractIdentifiers(target.code);

      const sharedDependencies: string[] = [];
      ids1.forEach((id) => {
        if (ids2.has(id)) sharedDependencies.push(id);
      });

      matches.push({
        source,
        target,
        similarity: metrics.overallScore,
        matchType: "ast-similarity",
        reason: `Code structure is ${metrics.overallScore}% similar across files`,
        sharedDependencies,
        commonPatterns: extractPatterns(source.code!).filter((p) =>
          extractPatterns(target.code!).includes(p)
        ),
      });
    }
  });

  return matches.sort((a, b) => b.similarity - a.similarity);
};
