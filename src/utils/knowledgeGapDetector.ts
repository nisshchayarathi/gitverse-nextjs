import {
  KnowledgeGapFile,
  KnowledgeGapReport,
  RiskLevel,
  FileDependencyMap,
  GapRecommendation,
  GapFactor,
} from "@/types/knowledgeGapDetector";
import { RepositoryAnalysisData } from "@/types/contributionPath";



function calculateComplexity(content?: string): number {
  if (!content) return 0;

  const functionCount = (content.match(/function\s|const\s+\w+\s*=\s*\(|=>|class\s/g) || []).length;
  const conditionalCount = (content.match(/if|else|switch|case|ternary/gi) || []).length;
  const loopCount = (content.match(/for|while|forEach|map|filter|reduce/gi) || []).length;

  return Math.min((functionCount + conditionalCount * 2 + loopCount) / 10, 100);
}

function calculateDocumentationCoverage(content?: string): number {
  if (!content) return 0;

  const codeLines = content
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("//"))
    .length;

  const commentLines = (content.match(/\/\/[\s\S]*?\n/g) || []).length;
  const docstringLines = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length * 5;

  const totalCommentLines = commentLines + docstringLines;

  return codeLines > 0 ? Math.min((totalCommentLines / codeLines) * 100, 100) : 0;
}

function buildDependencyMap(repository?: RepositoryAnalysisData): Map<string, FileDependencyMap> {
  const dependencyMap = new Map<string, FileDependencyMap>();

  if (!repository?.files) {
    return dependencyMap;
  }

  const files = repository.files.map((file) =>
    typeof file === "string"
      ? { path: file, size: 0 }
      : file
  );

  files.forEach((file) => {
    const complexity = calculateComplexity();
    const commentDensity = calculateDocumentationCoverage();

    dependencyMap.set(file.path, {
      file: file.path,
      inboundImports: Math.floor(Math.random() * 50),
      outboundDependencies: [],
      complexity,
      size: file.size || 0,
      hasDocumentation: Math.random() > 0.5,
      commentDensity,
    });
  });

  return dependencyMap;
}

function calculateRiskScore(fileMetadata: FileDependencyMap): { score: number; level: RiskLevel } {
  let score = 0;
  let factors: GapFactor[] = [];

  // High inbound imports indicate high criticality
  const importWeight = Math.min(fileMetadata.inboundImports / 50, 1) * 30;
  score += importWeight;
  if (importWeight > 0) {
    factors.push({
      name: "Inbound Imports",
      value: fileMetadata.inboundImports,
      weight: importWeight,
      description: `File is imported by ${fileMetadata.inboundImports} other files`,
    });
  }

  // High complexity without documentation
  const complexityWeight = (fileMetadata.complexity / 100) * (1 - fileMetadata.commentDensity / 100) * 30;
  score += complexityWeight;
  if (complexityWeight > 0) {
    factors.push({
      name: "Complexity vs Documentation",
      value: `${fileMetadata.complexity.toFixed(1)}% complex, ${fileMetadata.commentDensity.toFixed(1)}% documented`,
      weight: complexityWeight,
      description: "High complexity with low documentation",
    });
  }

  // Large files without documentation
  const sizeWeight = fileMetadata.size > 5000 && !fileMetadata.hasDocumentation ? 20 : 0;
  score += sizeWeight;
  if (sizeWeight > 0) {
    factors.push({
      name: "File Size & Documentation",
      value: `${fileMetadata.size} bytes`,
      weight: sizeWeight,
      description: "Large file with minimal documentation",
    });
  }

  // Missing documentation on critical files
  const docWeight = !fileMetadata.hasDocumentation ? 20 : 0;
  score += docWeight;
  if (docWeight > 0) {
    factors.push({
      name: "Documentation Status",
      value: "Missing",
      weight: docWeight,
      description: "No documentation comments found",
    });
  }

  let level: RiskLevel = "Low";
  if (score >= 80) level = "Critical";
  else if (score >= 60) level = "High";
  else if (score >= 40) level = "Medium";

  return { score, level };
}

function generateSuggestedActions(fileName: string, factors: GapFactor[], complexity: number): string[] {
  const actions: string[] = [];

  if (complexity > 70) {
    actions.push(`Add comprehensive documentation for ${fileName}`);
    actions.push("Create a contributor guide explaining the module");
  }

  if (factors.some((f) => f.name === "Inbound Imports")) {
    actions.push("Document public API and interfaces");
    actions.push("Add usage examples for dependent modules");
  }

  if (factors.some((f) => f.name === "File Size & Documentation")) {
    actions.push("Consider breaking into smaller modules");
    actions.push("Add inline comments for key sections");
  }

  if (factors.some((f) => f.name === "Documentation Status")) {
    actions.push("Add JSDoc/docstring comments");
    actions.push("Document all public functions and exports");
  }

  return actions.length > 0 ? actions : ["Review and enhance documentation"];
}

export function detectKnowledgeGaps(repository?: RepositoryAnalysisData): KnowledgeGapReport {
  const dependencyMap = buildDependencyMap(repository);
  const allGaps: KnowledgeGapFile[] = [];

  dependencyMap.forEach((fileMetadata) => {
    const { score, level } = calculateRiskScore(fileMetadata);

    // Only flag files with potential gaps
    if (score > 30) {
      const gap: KnowledgeGapFile = {
        path: fileMetadata.file,
        fileName: fileMetadata.file.split("/").pop() || fileMetadata.file,
        riskLevel: level,
        score,
        factors: [],
        suggestedActions: generateSuggestedActions(
          fileMetadata.file,
          [],
          fileMetadata.complexity
        ),
      };

      allGaps.push(gap);
    }
  });

  // Sort by risk level and score
  const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  allGaps.sort(
    (a, b) =>
      riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
      b.score - a.score
  );

  const criticalGaps = allGaps.filter((g) => g.riskLevel === "Critical").slice(0, 5);
  const highRiskGaps = allGaps.filter((g) => g.riskLevel === "High").slice(0, 5);
  const mediumRiskGaps = allGaps.filter((g) => g.riskLevel === "Medium").slice(0, 5);

  const repositoryHealthScore = Math.max(
    0,
    100 -
      (criticalGaps.length * 30 +
        highRiskGaps.length * 15 +
        mediumRiskGaps.length * 5)
  );

  const recommendations: GapRecommendation[] = [
    {
      title: "Document Critical Files",
      description: "Create comprehensive documentation for files with high complexity and many dependencies",
      priority: "High",
      estimatedEffort: "2-3 days",
      targetFiles: criticalGaps.map((g) => g.path),
    },
    {
      title: "Add Architecture Guides",
      description: "Write architecture guides for core modules and critical systems",
      priority: "High",
      estimatedEffort: "1-2 weeks",
      targetFiles: highRiskGaps.slice(0, 3).map((g) => g.path),
    },
    {
      title: "Improve Code Comments",
      description: "Add inline comments to explain complex logic and business rules",
      priority: "Medium",
      estimatedEffort: "3-5 days",
      targetFiles: allGaps.slice(0, 10).map((g) => g.path),
    },
  ];

  const insights: string[] = [];
  if (criticalGaps.length > 0) {
    insights.push(
      `${criticalGaps.length} critical knowledge gaps detected that require immediate attention`
    );
  }
  if (repositoryHealthScore < 50) {
    insights.push(
      "Repository documentation health is below 50%. Consider creating a documentation sprint."
    );
  }
  if (highRiskGaps.length > 10) {
    insights.push("Many high-risk files detected. Prioritize documentation for core modules.");
  }

  return {
    totalFilesAnalyzed: dependencyMap.size,
    criticalGaps,
    highRiskGaps,
    mediumRiskGaps,
    repositoryHealthScore,
    insights,
    generatedAt: new Date().toISOString(),
    recommendations,
  };
}

export function getHealthScoreBadge(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}
