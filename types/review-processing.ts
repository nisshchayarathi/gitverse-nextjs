export type PRReviewMode = 'Standard' | 'Chunked' | 'Degraded' | 'Warning';

export type PartialReviewStatus = 
  | 'Processing' 
  | 'Completed' 
  | 'Partial' 
  | 'Failed' 
  | 'TimedOut';

export interface PRSizeMetrics {
  fileCount: number;
  totalLines: number;
  estimatedTokens: number;
  complexityScore: number;
}

export interface ReviewThresholds {
  warningFileCount: number;
  chunkedFileCount: number;
  degradedFileCount: number;
}

export const DEFAULT_REVIEW_THRESHOLDS: ReviewThresholds = {
  warningFileCount: 100,
  chunkedFileCount: 250,
  degradedFileCount: 500
};

export interface ChunkedReviewResult {
  status: PartialReviewStatus;
  reviewedFileCount: number;
  totalFileCount: number;
  modeUsed: PRReviewMode;
  errorReason?: string;
}
