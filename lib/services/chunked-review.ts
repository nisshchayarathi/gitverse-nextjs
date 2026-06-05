import { PRReviewResponse } from "./prReviewService";
import { TimeoutEstimatorService } from "./timeout-estimator";
import { reviewAggregator } from "./review-aggregator";
import { ChunkedReviewResult, PartialReviewStatus, PRReviewMode } from "../../types/review-processing";

export interface ChunkedReviewOptions {
  files: Array<{
    filename: string;
    status: string;
    patch?: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
  timeoutEstimator: TimeoutEstimatorService;
  chunkSize: number;
  processChunk: (chunkFiles: any[], chunkIndex: number, totalChunks: number) => Promise<PRReviewResponse | null>;
  mode: PRReviewMode;
}

export class ChunkedReviewService {
  public async executeChunkedReview(options: ChunkedReviewOptions): Promise<{ result: ChunkedReviewResult, review: PRReviewResponse | null }> {
    const { files, timeoutEstimator, chunkSize, processChunk, mode } = options;
    
    if (files.length === 0) {
      return {
        result: { status: 'Completed', reviewedFileCount: 0, totalFileCount: 0, modeUsed: mode },
        review: null
      };
    }

    const reviews: PRReviewResponse[] = [];
    let reviewedCount = 0;
    const totalFiles = files.length;
    let status: PartialReviewStatus = 'Processing';
    let errorReason: string | undefined = undefined;

    const chunks = this.createChunks(files, chunkSize);
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      if (timeoutEstimator.isTimeExhausted()) {
        status = 'Partial';
        errorReason = `Execution time budget exhausted. Stopped after ${reviewedCount} files.`;
        console.warn(`[ChunkedReview] Bailing early due to time limits. Chunk ${i+1}/${totalChunks} aborted.`);
        break;
      }

      try {
        const chunkReview = await processChunk(chunks[i], i + 1, totalChunks);
        if (chunkReview) {
          reviews.push(chunkReview);
        }
        reviewedCount += chunks[i].length;
      } catch (err: any) {
        console.error(`[ChunkedReview] Error processing chunk ${i+1}:`, err);
        status = 'Partial';
        errorReason = err?.message || 'Chunk processing failed';
        break;
      }
    }

    if (status === 'Processing') {
      status = 'Completed';
    } else if (reviews.length === 0) {
      status = 'Failed';
    }

    const aggregatedReview = reviews.length > 0 ? reviewAggregator.aggregate(reviews) : null;

    if (aggregatedReview && status === 'Partial') {
      aggregatedReview.summary = `**[PARTIAL REVIEW]**\n*Notice: Due to PR size, only ${reviewedCount} out of ${totalFiles} files were reviewed to prevent timeouts.*\n\n` + aggregatedReview.summary;
    }

    return {
      result: {
        status,
        reviewedFileCount: reviewedCount,
        totalFileCount: totalFiles,
        modeUsed: mode,
        errorReason
      },
      review: aggregatedReview
    };
  }

  private createChunks<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const chunkedReviewService = new ChunkedReviewService();
