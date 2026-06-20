import { GeneratedIssue, GeneratorConfig } from "@/types/generatedIssue";
import { RepositoryFile, RepositoryMetadata } from "@/types/firstPRSimulator";
import { detectOpportunities } from "@/utils/opportunityDetector";
import { generateIssueDrafts } from "@/utils/issueDraftGenerator";

/**
 * Generates good first issues from repository analysis
 * @param repository The repository metadata and file structure
 * @param config Optional configuration for issue generation
 * @returns Array of generated issue drafts
 */
export const generateGoodFirstIssues = (
  repository: RepositoryMetadata,
  config: GeneratorConfig = {}
): GeneratedIssue[] => {
  const files = repository.files || [];

  if (files.length === 0) {
    return [];
  }

  // Detect all opportunities in the repository
  const opportunities = detectOpportunities(files);

  if (opportunities.length === 0) {
    return [];
  }

  // Filter opportunities based on confidence and config
  const minConfidence = config.minConfidenceScore ?? 0.5;
  const filteredOpportunities = opportunities.filter(
    (opp) => {
      // Calculate basic confidence based on opportunity type
      const baseConfidence = 0.8;
      // TODO comments might need validation
      if (opp.type === "missing-tests") return true;
      if (opp.type === "dead-code") return true;
      if (opp.type === "refactoring") return true;
      if (opp.type === "documentation") return true;
      return baseConfidence >= minConfidence;
    }
  );

  // Apply category limits
  const maxPerCategory = config.maxIssuesPerCategory ?? 2;
  const categoryCount: Record<string, number> = {};
  const limitedOpportunities = filteredOpportunities.filter((opp) => {
    const count = categoryCount[opp.type] || 0;
    if (count >= maxPerCategory) return false;
    categoryCount[opp.type] = count + 1;
    return true;
  });

  // Generate issue drafts from opportunities
  const issues = generateIssueDrafts(
    limitedOpportunities,
    files,
    {
      name: repository.name,
      url: repository.id?.toString(),
    }
  );

  return issues;
};

/**
 * Generates a single good first issue draft
 * @param repository The repository metadata
 * @param opportunityIndex The index of the opportunity to generate
 * @returns Generated issue draft or null if not found
 */
export const generateSingleIssue = (
  repository: RepositoryMetadata,
  opportunityIndex: number
): GeneratedIssue | null => {
  const issues = generateGoodFirstIssues(repository);
  return issues[opportunityIndex] || null;
};

/**
 * Analyzes repository and returns suggested issues by difficulty
 * @param repository The repository metadata
 * @returns Object with issues grouped by difficulty level
 */
export const getIssuesByDifficulty = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);

  return {
    beginner: issues.filter((i) => i.difficulty === "Beginner"),
    intermediate: issues.filter((i) => i.difficulty === "Intermediate"),
    advanced: issues.filter((i) => i.difficulty === "Advanced"),
    all: issues,
  };
};

/**
 * Gets issue statistics for analytics
 * @param repository The repository metadata
 * @returns Statistics object
 */
export const getGeneratorStats = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);
  const files = repository.files || [];

  const statsByType: Record<string, number> = {};
  const statsByDifficulty: Record<string, number> = {};

  issues.forEach((issue) => {
    statsByType[issue.opportunity.type] = (statsByType[issue.opportunity.type] || 0) + 1;
    statsByDifficulty[issue.difficulty] = (statsByDifficulty[issue.difficulty] || 0) + 1;
  });

  return {
    totalIssues: issues.length,
    totalFiles: files.length,
    issuesByType: statsByType,
    issuesByDifficulty: statsByDifficulty,
    averageEffort:
      issues.reduce((sum, i) => sum + i.estimatedHours, 0) / Math.max(issues.length, 1),
    hasIssues: issues.length > 0,
  };
};

/**
 * Validates if a repository has analyzable content
 * @param repository The repository metadata
 * @returns Boolean indicating if analysis is possible
 */
export const canAnalyzeRepository = (repository: RepositoryMetadata): boolean => {
  return (repository.files?.length ?? 0) > 0;
};
