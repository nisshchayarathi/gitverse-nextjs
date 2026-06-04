import { DuplicateCluster, RefactorRecommendation, FeatureType } from "@/types/duplicateFeature";

/**
 * Generate refactoring recommendations from duplicate clusters
 */
export const generateRefactorRecommendations = (
  clusters: DuplicateCluster[]
): RefactorRecommendation[] => {
  return clusters
    .filter((c) => c.severity !== "low")
    .map((cluster) => createRecommendation(cluster))
    .sort((a, b) => {
      // Prioritize by affected files and effort
      const aWeight = (a.affectedFiles.length * 10) / Math.max(a.estimatedHours, 1);
      const bWeight = (b.affectedFiles.length * 10) / Math.max(b.estimatedHours, 1);
      return bWeight - aWeight;
    });
};

/**
 * Create a detailed recommendation for a cluster
 */
const createRecommendation = (cluster: DuplicateCluster): RefactorRecommendation => {
  const templates = getTemplateForType(cluster.featureType, cluster);
  const affectedFiles = [...new Set(cluster.instances.map((i) => i.filePath))];

  const estimatedLinesReduced = cluster.potentialSavings;
  const totalLinesInCluster = cluster.totalLines;
  const complexityReduction = Math.round(
    (estimatedLinesReduced / Math.max(totalLinesInCluster, 1)) * 100 * 0.8
  );

  // Extract dependencies from instances
  const dependencies = extractDependencies(cluster);

  // Determine risk level based on cluster characteristics
  const riskLevel = determineRiskLevel(cluster);

  // Estimate effort
  const { estimatedHours, estimatedEffort } = estimateEffort(cluster, affectedFiles.length);

  return {
    clusterId: cluster.id,
    title: templates.title,
    description: templates.description,
    extractedName: templates.extractedName,
    targetLocation: suggestTargetLocation(cluster),
    affectedFiles,
    estimatedLinesReduced,
    estimatedComplexityReduction: complexityReduction,
    dependencies,
    riskLevel,
    implementationSteps: generateImplementationSteps(cluster, templates),
    estimatedEffort,
    estimatedHours,
    expectedBenefits: generateBenefits(cluster, estimatedLinesReduced),
    potentialRisks: generateRisks(cluster, riskLevel),
  };
};

/**
 * Get template for recommendation based on feature type
 */
const getTemplateForType = (
  featureType: FeatureType,
  cluster: DuplicateCluster
): {
  title: string;
  description: string;
  extractedName: string;
} => {
  const templates: Record<
    FeatureType,
    {
      title: string;
      description: string;
      extractedName: string;
    }
  > = {
    validation: {
      title: "Extract Shared Validation Utility",
      description:
        "Consolidate repeated validation logic into a reusable validation utility module. This reduces code duplication and makes validation rules easier to maintain.",
      extractedName: "validators",
    },
    authentication: {
      title: "Create Unified Authentication Service",
      description:
        "Combine authentication logic spread across multiple files into a centralized authentication service. This ensures consistent authentication behavior and reduces maintenance overhead.",
      extractedName: "authService",
    },
    "api-request": {
      title: "Build API Client Abstraction",
      description:
        "Extract common API request patterns into a reusable API client. This provides a single point for managing API calls, error handling, and request middleware.",
      extractedName: "apiClient",
    },
    "error-handling": {
      title: "Standardize Error Handling",
      description:
        "Create a centralized error handler to replace repeated error handling patterns. This ensures consistent error responses and simplifies error recovery logic.",
      extractedName: "errorHandler",
    },
    utility: {
      title: "Extract Reusable Utility Functions",
      description:
        "Move shared utility functions to a dedicated utilities module. This improves code organization and prevents duplicate implementations.",
      extractedName: "utils",
    },
    "business-rule": {
      title: "Extract Business Logic",
      description:
        "Abstract repeated business rules into dedicated modules. This makes business logic easier to test and modify in the future.",
      extractedName: "businessLogic",
    },
    "data-transformation": {
      title: "Create Data Transformation Service",
      description:
        "Consolidate data transformation logic into a dedicated transformer service. This provides a consistent interface for data processing.",
      extractedName: "transformer",
    },
    "state-management": {
      title: "Unify State Management",
      description:
        "Combine state management patterns into a consistent state store. This simplifies state updates and makes state logic easier to debug.",
      extractedName: "store",
    },
  };

  return templates[featureType];
};

/**
 * Suggest target location for extracted code
 */
const suggestTargetLocation = (cluster: DuplicateCluster): string => {
  const featureMap: Record<FeatureType, string> = {
    validation: "src/utils/validators.ts",
    authentication: "src/services/authService.ts",
    "api-request": "src/services/apiClient.ts",
    "error-handling": "src/utils/errorHandler.ts",
    utility: "src/utils/helpers.ts",
    "business-rule": "src/services/businessRules.ts",
    "data-transformation": "src/services/transformer.ts",
    "state-management": "src/context/store.ts",
  };

  return featureMap[cluster.featureType];
};

/**
 * Extract dependencies from cluster instances
 */
const extractDependencies = (cluster: DuplicateCluster): string[] => {
  const dependencies = new Set<string>();

  cluster.instances.forEach((instance) => {
    if (instance.code) {
      // Match import statements
      const imports = instance.code.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g) || [];
      imports.forEach((imp) => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match) dependencies.add(match[1]);
      });
    }
  });

  return Array.from(dependencies).slice(0, 10);
};

/**
 * Determine risk level for refactoring
 */
const determineRiskLevel = (cluster: DuplicateCluster): "low" | "medium" | "high" => {
  if (cluster.averageSimilarity > 90 && cluster.instances.length <= 2) {
    return "low"; // Small, very similar duplicates are low risk
  }
  if (cluster.instances.length > 5) {
    return "high"; // Many instances increase risk
  }
  if (cluster.featureType === "authentication" || cluster.featureType === "api-request") {
    return "medium"; // Core systems are riskier
  }
  return "medium";
};

/**
 * Estimate effort for refactoring
 */
const estimateEffort = (
  cluster: DuplicateCluster,
  affectedFileCount: number
): { estimatedHours: number; estimatedEffort: "low" | "medium" | "high" } => {
  // Base effort on affected files and cluster complexity
  let hours = 2; // Minimum 2 hours

  // Add time based on affected files
  hours += Math.min(affectedFileCount, 5) * 1;

  // Add time based on similarity (higher similarity = less time to extract common logic)
  if (cluster.averageSimilarity < 75) {
    hours += 2; // Need more analysis for less similar code
  }

  // Add time based on feature type
  const typeEffortMap: Record<FeatureType, number> = {
    validation: 2,
    authentication: 4,
    "api-request": 3,
    "error-handling": 2,
    utility: 2,
    "business-rule": 3,
    "data-transformation": 3,
    "state-management": 4,
  };

  hours += typeEffortMap[cluster.featureType] || 2;

  let effort: "low" | "medium" | "high" = "low";
  if (hours <= 4) effort = "low";
  else if (hours <= 8) effort = "medium";
  else effort = "high";

  return { estimatedHours: Math.round(hours), estimatedEffort: effort };
};

/**
 * Generate implementation steps
 */
const generateImplementationSteps = (
  cluster: DuplicateCluster,
  templates: {
    title: string;
    description: string;
    extractedName: string;
  }
): string[] => {
  const baseSteps = [
    `Create new module: ${templates.extractedName}`,
    `Extract common logic from ${cluster.instances.length} instances`,
    `Add comprehensive tests for extracted functionality`,
    `Update imports in affected files to use extracted module`,
    `Remove duplicated code from original locations`,
    `Verify all tests pass and application functions correctly`,
  ];

  // Add type-specific steps
  if (cluster.featureType === "validation") {
    baseSteps.splice(2, 0, "Define validation rules and schemas");
  } else if (cluster.featureType === "authentication") {
    baseSteps.splice(2, 0, "Ensure backwards compatibility with existing auth flows");
  } else if (cluster.featureType === "api-request") {
    baseSteps.splice(2, 0, "Implement interceptors for request/response handling");
  }

  return baseSteps;
};

/**
 * Generate expected benefits
 */
const generateBenefits = (cluster: DuplicateCluster, estimatedLinesReduced: number): string[] => {
  return [
    `Reduce codebase by ~${estimatedLinesReduced} lines`,
    "Easier maintenance through single source of truth",
    `Improved consistency across ${cluster.instances.length} instances`,
    "Reduced cognitive load for developers",
    "Easier to implement updates across the codebase",
    "Improved test coverage efficiency",
  ];
};

/**
 * Generate potential risks
 */
const generateRisks = (
  cluster: DuplicateCluster,
  riskLevel: "low" | "medium" | "high"
): string[] => {
  const risks: string[] = [];

  if (riskLevel === "high") {
    risks.push("Multiple files dependent on current implementation");
    risks.push("Higher chance of regression if refactoring is incomplete");
  }

  if (cluster.featureType === "authentication") {
    risks.push("Security implications need careful review");
    risks.push("Regression could impact user access");
  }

  if (cluster.featureType === "api-request") {
    risks.push("Integration changes could break external dependencies");
  }

  if (cluster.instances.length > 5) {
    risks.push("Large number of affected files increases refactoring scope");
  }

  if (cluster.averageSimilarity < 80) {
    risks.push("Lower similarity may indicate different use cases");
    risks.push("Extraction might not cover all scenarios");
  }

  return risks.slice(0, 5); // Limit to top 5 risks
};

/**
 * Create a summary of refactoring impact
 */
export const summarizeRefactorImpact = (
  recommendations: RefactorRecommendation[]
): {
  totalLinesReducible: number;
  totalAffectedFiles: number;
  totalEstimatedHours: number;
  averageRiskLevel: string;
} => {
  const totalLinesReducible = recommendations.reduce(
    (sum, r) => sum + r.estimatedLinesReduced,
    0
  );
  const allAffectedFiles = new Set<string>();
  recommendations.forEach((r) => {
    r.affectedFiles.forEach((f) => allAffectedFiles.add(f));
  });

  const totalEstimatedHours = recommendations.reduce((sum, r) => sum + r.estimatedHours, 0);

  const riskCounts = {
    low: recommendations.filter((r) => r.riskLevel === "low").length,
    medium: recommendations.filter((r) => r.riskLevel === "medium").length,
    high: recommendations.filter((r) => r.riskLevel === "high").length,
  };

  let averageRiskLevel = "medium";
  if (riskCounts.high > recommendations.length / 2) averageRiskLevel = "high";
  else if (riskCounts.low > recommendations.length / 2) averageRiskLevel = "low";

  return {
    totalLinesReducible,
    totalAffectedFiles: allAffectedFiles.size,
    totalEstimatedHours,
    averageRiskLevel,
  };
};
