import { RepositoryFile } from "@/types/firstPRSimulator";
import { DifficultyCategory, OpportunitySuggestion } from "@/types/generatedIssue";

interface DifficultyFactors {
  affectedFileCount: number;
  averageFileSize: number;
  dependencyDepth: number;
  complexityScore: number;
  isNewArea: boolean;
  requiresArchitectureChange: boolean;
}

export const calculateDifficultyFactors = (
  affectedFiles: string[],
  allFiles: RepositoryFile[]
): DifficultyFactors => {
  const relevantFiles = allFiles.filter((f) =>
    affectedFiles.some((af) => f.path === af)
  );

  const averageFileSize =
    relevantFiles.reduce((sum, f) => sum + (f.lines || 0), 0) / Math.max(relevantFiles.length, 1);

  // Estimate dependency depth by counting imports
  let maxDependencyDepth = 1;
  relevantFiles.forEach((file) => {
    const importCount = file.imports?.length || 0;
    const depth = Math.ceil(importCount / 5); // Every 5 imports = 1 depth level
    maxDependencyDepth = Math.max(maxDependencyDepth, depth);
  });

  // Calculate complexity score based on various factors
  const complexityScore =
    (averageFileSize / 500) * 30 + // File size contributes 30 points max
    (maxDependencyDepth / 5) * 20 + // Dependency depth contributes 20 points max
    (affectedFiles.length / 5) * 20 + // Number of files contributes 20 points max
    (relevantFiles.some((f) => f.path?.includes("core") || f.path?.includes("api"))
      ? 20
      : 0); // Core/API files add complexity

  return {
    affectedFileCount: affectedFiles.length,
    averageFileSize,
    dependencyDepth: maxDependencyDepth,
    complexityScore: Math.min(complexityScore, 100),
    isNewArea:
      !allFiles.some((f) =>
        affectedFiles.some((af) => f.path === af)
      ),
    requiresArchitectureChange: affectedFiles.some((af) =>
      [
        "schema",
        "config",
        "core",
        "middleware",
        "types",
      ].some((keyword) => af.toLowerCase().includes(keyword))
    ),
  };
};

export const estimateDifficulty = (
  opportunity: OpportunitySuggestion,
  allFiles: RepositoryFile[]
): DifficultyCategory => {
  const factors = calculateDifficultyFactors(opportunity.affectedFiles, allFiles);

  // Base difficulty from opportunity type
  let difficultyScore = 0;

  switch (opportunity.type) {
    case "missing-tests":
      difficultyScore = 20;
      break;
    case "dead-code":
      difficultyScore = 15;
      break;
    case "documentation":
      difficultyScore = 10;
      break;
    case "ui-consistency":
      difficultyScore = 25;
      break;
    case "type-safety":
      difficultyScore = 30;
      break;
    case "refactoring":
      difficultyScore = 40;
      break;
    case "performance":
      difficultyScore = 35;
      break;
    case "accessibility":
      difficultyScore = 25;
      break;
  }

  // Adjust based on complexity factors
  difficultyScore += factors.complexityScore * 0.5; // Complexity can add up to 50 points

  // Add bonus points for specific risk factors
  if (factors.requiresArchitectureChange) difficultyScore += 20;
  if (factors.isNewArea) difficultyScore += 10;
  if (factors.dependencyDepth > 4) difficultyScore += 15;

  // Normalize to 0-100
  difficultyScore = Math.min(difficultyScore, 100);

  // Map score ranges to difficulty levels
  if (difficultyScore < 35) {
    return "Beginner";
  } else if (difficultyScore < 70) {
    return "Intermediate";
  } else {
    return "Advanced";
  }
};

export const estimateEffortHours = (
  opportunity: OpportunitySuggestion,
  allFiles: RepositoryFile[]
): number => {
  const factors = calculateDifficultyFactors(opportunity.affectedFiles, allFiles);

  // Base effort in hours based on opportunity type
  let baseHours = 0;

  switch (opportunity.type) {
    case "missing-tests":
      baseHours = 2;
      break;
    case "dead-code":
      baseHours = 1;
      break;
    case "documentation":
      baseHours = 2;
      break;
    case "ui-consistency":
      baseHours = 3;
      break;
    case "type-safety":
      baseHours = 4;
      break;
    case "refactoring":
      baseHours = 5;
      break;
    case "performance":
      baseHours = 4;
      break;
    case "accessibility":
      baseHours = 3;
      break;
  }

  // Adjust based on factors
  const fileCountMultiplier = Math.min(factors.affectedFileCount / 2, 3); // Up to 3x for many files
  const sizeMultiplier = factors.averageFileSize > 300 ? 1.5 : 1; // Larger files take longer
  const complexityMultiplier = factors.complexityScore > 60 ? 1.3 : 1; // Complexity adds time

  let estimatedHours = baseHours * fileCountMultiplier * sizeMultiplier * complexityMultiplier;

  // Round to reasonable estimates
  if (estimatedHours < 1) return 0.5;
  if (estimatedHours < 2) return 1;
  if (estimatedHours < 4) return 2;
  if (estimatedHours < 8) return 4;
  if (estimatedHours < 16) return 8;
  return 16;
};

export const categorizeEffort = (
  hours: number
): "low" | "medium" | "high" => {
  if (hours <= 2) return "low";
  if (hours <= 8) return "medium";
  return "high";
};
