import { PRReviewMode, PRSizeMetrics, DEFAULT_REVIEW_THRESHOLDS } from "../../types/review-processing";

export class PRSizeAnalyzerService {
  public analyzeSize(
    files: Array<{ filename: string; additions: number; deletions: number; changes: number }>
  ): PRSizeMetrics {
    let totalLines = 0;
    
    for (const f of files) {
      totalLines += f.changes;
    }

    // Rough estimate: ~5 chars per token, ~30 chars per line of code on average
    const estimatedTokens = Math.floor((totalLines * 30) / 5);

    return {
      fileCount: files.length,
      totalLines,
      estimatedTokens,
      complexityScore: (files.length * 10) + (totalLines / 100)
    };
  }

  public determineReviewMode(metrics: PRSizeMetrics): PRReviewMode {
    if (metrics.fileCount > DEFAULT_REVIEW_THRESHOLDS.degradedFileCount) {
      return 'Degraded';
    }
    if (metrics.fileCount > DEFAULT_REVIEW_THRESHOLDS.chunkedFileCount) {
      return 'Chunked';
    }
    if (metrics.fileCount > DEFAULT_REVIEW_THRESHOLDS.warningFileCount) {
      return 'Warning';
    }
    return 'Standard';
  }

  public getModeNotice(mode: PRReviewMode, metrics: PRSizeMetrics): string {
    switch(mode) {
      case 'Degraded':
        return `### ⚠️ GitVerse Large PR Notice\n\nThis PR exceeds recommended review size (${metrics.fileCount} files). Only top priority files will be analyzed to prevent timeouts. Recommendation: Split PR into smaller logical changesets.`;
      case 'Chunked':
        return `### ℹ️ GitVerse Large PR Notice\n\nThis PR is very large (${metrics.fileCount} files) and will be reviewed in chunks. Processing may take longer than usual.`;
      case 'Warning':
        return `### ℹ️ GitVerse Notice\n\nThis PR is quite large (${metrics.fileCount} files). Consider breaking future changes down into smaller PRs for faster reviews.`;
      default:
        return '';
    }
  }
}

export const prSizeAnalyzer = new PRSizeAnalyzerService();
