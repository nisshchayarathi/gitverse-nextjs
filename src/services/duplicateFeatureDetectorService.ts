import { RepositoryMetadata, RepositoryFile } from "@/types/firstPRSimulator";
import {
  RepositoryDuplicateAnalysis,
  DuplicateDetectionConfig,
  DuplicateDetectionResult,
} from "@/types/duplicateFeature";
import { clusterDuplicates, calculateDuplicateMetrics, identifyOpportunities } from "@/utils/duplicateDetection";
import {
  generateRefactorRecommendations,
  summarizeRefactorImpact,
} from "@/utils/refactorSuggestion";

/**
 * Analyze repository for duplicate code and features
 * Main entry point for duplicate detection
 */
export const analyzeDuplicateFeatures = (
  repository: RepositoryMetadata,
  config: DuplicateDetectionConfig = {}
): RepositoryDuplicateAnalysis => {
  const files = repository.files || [];

  if (files.length === 0) {
    return createEmptyAnalysis();
  }

  // Use default config values
  const minSimilarityThreshold = config.minSimilarityThreshold ?? 70;
  const minLineThreshold = config.minLineThreshold ?? 10;

  // Cluster duplicates
  const clusters = clusterDuplicates(files, minSimilarityThreshold);

  if (clusters.length === 0) {
    return createEmptyAnalysis();
  }

  // Generate refactor recommendations
  const recommendations = generateRefactorRecommendations(clusters);

  // Calculate metrics
  const metrics = calculateDuplicateMetrics(clusters);

  // Identify opportunities
  const opportunities = identifyOpportunities(clusters);

  // Determine severity counts
  const highSeverityCount = clusters.filter((c) => c.severity === "high").length;
  const mediumSeverityCount = clusters.filter((c) => c.severity === "medium").length;
  const lowSeverityCount = clusters.filter((c) => c.severity === "low").length;

  return {
    totalClusters: clusters.length,
    totalDuplicates: metrics.totalDuplicates,
    totalAffectedFiles: metrics.totalAffectedFiles,
    totalDuplicatedLines: metrics.totalDuplicatedLines,
    averageClusterSimilarity: clusters.length > 0
      ? Math.round(clusters.reduce((sum, c) => sum + c.averageSimilarity, 0) / clusters.length)
      : 0,
    clusters,
    recommendations,
    summary: {
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      potentialImprovements: opportunities,
    },
  };
};

/**
 * Get detailed analysis for a specific cluster
 */
export const getClusterDetails = (
  repository: RepositoryMetadata,
  clusterId: string,
  config: DuplicateDetectionConfig = {}
): DuplicateDetectionResult | null => {
  const analysis = analyzeDuplicateFeatures(repository, config);
  const cluster = analysis.clusters.find((c) => c.id === clusterId);

  if (!cluster) return null;

  const recommendation = analysis.recommendations.find((r) => r.clusterId === clusterId);

  return {
    clusterId,
    duplicates: cluster,
    recommendation,
    metrics: {
      totalDuplicates: cluster.instances.length,
      totalAffectedFiles: new Set(cluster.instances.map((i) => i.filePath)).size,
      totalDuplicatedLines: cluster.totalLines,
      potentialSavingsPercentage: Math.round((cluster.potentialSavings / cluster.totalLines) * 100),
      technicalDebtReduction: Math.round(
        (cluster.potentialSavings / Math.max(cluster.totalLines, 1)) * 100 * 0.8
      ),
    },
  };
};

/**
 * Get recommendations grouped by impact
 */
export const getRecommendationsByImpact = (repository: RepositoryMetadata) => {
  const analysis = analyzeDuplicateFeatures(repository);
  const recommendations = analysis.recommendations;

  const impact = summarizeRefactorImpact(recommendations);

  return {
    recommendations,
    impact,
    highImpactRecommendations: recommendations
      .filter((r) => r.affectedFiles.length >= 3)
      .slice(0, 5),
    quickWins: recommendations
      .filter((r) => r.estimatedHours <= 4 && r.estimatedLinesReduced > 50)
      .slice(0, 3),
  };
};

/**
 * Calculate code quality metrics based on duplicates
 */
export const calculateDuplicateMetrics = (repository: RepositoryMetadata) => {
  const analysis = analyzeDuplicateFeatures(repository);

  const totalFiles = repository.files?.length || 0;
  const affectedByDuplicates = analysis.totalAffectedFiles;
  const duplicatePercentage = totalFiles > 0 ? (affectedByDuplicates / totalFiles) * 100 : 0;

  const totalCodeLines = repository.files?.reduce((sum, f) => sum + ((f.lines || 0)), 0) || 0;
  const duplicatedPercentage = totalCodeLines > 0
    ? (analysis.totalDuplicatedLines / totalCodeLines) * 100
    : 0;

  return {
    totalFiles,
    filesDuplicatedCount: affectedByDuplicates,
    duplicatePercentageOfCode: Math.round(duplicatedPercentage),
    duplicatedLines: analysis.totalDuplicatedLines,
    estimatedDebtReduction: analysis.summary.highSeverityCount * 15 + analysis.summary.mediumSeverityCount * 8,
    priorityRefactorings: analysis.recommendations.filter((r) => r.riskLevel === "low").length,
  };
};

/**
 * Validate if repository can be analyzed
 */
export const canAnalyzeDuplicates = (repository: RepositoryMetadata): boolean => {
  return (repository.files?.length ?? 0) > 1;
};

/**
 * Get statistics for display
 */
export const getDuplicateStats = (repository: RepositoryMetadata) => {
  const analysis = analyzeDuplicateFeatures(repository);

  return {
    hasIssues: analysis.totalClusters > 0,
    criticalDuplicates: analysis.summary.highSeverityCount,
    moderateDuplicates: analysis.summary.mediumSeverityCount,
    minorDuplicates: analysis.summary.lowSeverityCount,
    totalDuplicates: analysis.totalDuplicates,
    totalAffectedFiles: analysis.totalAffectedFiles,
    potentialImprovements: analysis.summary.potentialImprovements,
    recommendations: analysis.recommendations,
  };
};

/**
 * Create empty analysis result
 */
const createEmptyAnalysis = (): RepositoryDuplicateAnalysis => ({
  totalClusters: 0,
  totalDuplicates: 0,
  totalAffectedFiles: 0,
  totalDuplicatedLines: 0,
  averageClusterSimilarity: 0,
  clusters: [],
  recommendations: [],
  summary: {
    highSeverityCount: 0,
    mediumSeverityCount: 0,
    lowSeverityCount: 0,
    potentialImprovements: [],
  },
});
