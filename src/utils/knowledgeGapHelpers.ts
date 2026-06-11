/**
 * Helper utilities for Knowledge Gap Detection
 * Provides utility functions for gap analysis and reporting
 */

import { KnowledgeGapFile, RiskLevel } from "@/types/knowledgeGapDetector";
import { KNOWLEDGE_GAP_CONFIG } from "@/config/knowledgeGapConfig";

/**
 * Check if a file matches priority patterns
 */
export function isPriorityFile(filePath: string): boolean {
  return KNOWLEDGE_GAP_CONFIG.priorityPatterns.some((pattern) =>
    pattern.test(filePath)
  );
}

/**
 * Check if file extension is analyzable
 */
export function isAnalyzableFile(filePath: string): boolean {
  return KNOWLEDGE_GAP_CONFIG.analyzableExtensions.some((ext) =>
    filePath.endsWith(ext)
  );
}

/**
 * Get color for risk level
 */
export function getRiskColor(level: RiskLevel): string {
  const colors = {
    Critical: "text-red-600 bg-red-50",
    High: "text-orange-600 bg-orange-50",
    Medium: "text-yellow-600 bg-yellow-50",
    Low: "text-blue-600 bg-blue-50",
  };
  return colors[level];
}

/**
 * Get suggested actions for a file based on risk level
 */
export function getActionsForRisk(level: RiskLevel): string[] {
  return KNOWLEDGE_GAP_CONFIG.actionsByRisk[level] || [];
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Calculate percentage for progress display
 */
export function calculateCoveragePercentage(
  documentedFiles: number,
  totalFiles: number
): number {
  if (totalFiles === 0) return 0;
  return Math.round((documentedFiles / totalFiles) * 100);
}

/**
 * Sort gaps by risk level and score
 */
export function sortGapsByPriority(gaps: KnowledgeGapFile[]): KnowledgeGapFile[] {
  const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return [...gaps].sort(
    (a, b) =>
      riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.score - a.score
  );
}

/**
 * Filter gaps by risk level
 */
export function filterGapsByRisk(
  gaps: KnowledgeGapFile[],
  level: RiskLevel
): KnowledgeGapFile[] {
  return gaps.filter((gap) => gap.riskLevel === level);
}

/**
 * Create a summary of knowledge gaps for reporting
 */
export function createGapSummary(
  totalGaps: number,
  criticalCount: number,
  highCount: number,
  mediumCount: number
): string {
  const parts: string[] = [];

  if (criticalCount > 0) {
    parts.push(`${criticalCount} critical`);
  }
  if (highCount > 0) {
    parts.push(`${highCount} high-risk`);
  }
  if (mediumCount > 0) {
    parts.push(`${mediumCount} medium-risk`);
  }

  if (parts.length === 0) {
    return "No significant knowledge gaps detected";
  }

  return `Found ${parts.join(", ")} knowledge gaps out of ${totalGaps} total files analyzed`;
}

/**
 * Generate health score trend message
 */
export function getHealthTrendMessage(score: number, previousScore?: number): string {
  if (!previousScore) {
    return `Current health score: ${score}%`;
  }

  const difference = score - previousScore;
  if (difference > 0) {
    return `Health improved by ${difference}% (${previousScore}% → ${score}%)`;
  } else if (difference < 0) {
    return `Health declined by ${Math.abs(difference)}% (${previousScore}% → ${score}%)`;
  }
  return `Health score stable at ${score}%`;
}

/**
 * Estimate effort for documentation task
 */
export function estimateDocumentationEffort(
  fileCount: number,
  avgComplexity: number
): string {
  const baseEffort = fileCount * 0.5; // 30 min per file
  const complexityMultiplier = 1 + avgComplexity / 100;
  const totalHours = (baseEffort * complexityMultiplier) / 60;

  if (totalHours < 1) return "< 1 hour";
  if (totalHours < 8) return `${Math.round(totalHours)} hours`;
  const days = totalHours / 8;
  if (days < 7) return `${Math.round(days)} days`;
  const weeks = days / 5;
  return `${Math.round(weeks)} weeks`;
}
