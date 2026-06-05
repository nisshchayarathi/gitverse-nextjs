import { chunkedReviewService } from "../chunked-review";
import { TimeoutEstimatorService } from "../timeout-estimator";
import { PRReviewResponse } from "../prReviewService";

describe("Chunked Review Engine", () => {
  it("processes a small PR normally", async () => {
    const files = Array(10).fill({ filename: "test.ts", changes: 10, additions: 10, deletions: 0, patch: "...", status: "modified" });
    const estimator = new TimeoutEstimatorService();

    let chunksProcessed = 0;
    const processChunk = async (chunk: any[], index: number, total: number) => {
      chunksProcessed++;
      return {
        summary: `Chunk ${index}`,
        overallScore: 80,
        issues: [{ title: "Issue 1", severity: "low", category: "style", file: "test.ts", line: 1, explanation: "Exp", suggestion: "Sug" }],
        praise: ["Good code"]
      } as PRReviewResponse;
    };

    const { result, review } = await chunkedReviewService.executeChunkedReview({
      files,
      timeoutEstimator: estimator,
      chunkSize: 50,
      processChunk,
      mode: 'Standard'
    });

    expect(result.status).toBe('Completed');
    expect(result.reviewedFileCount).toBe(10);
    expect(chunksProcessed).toBe(1);
    expect(review?.overallScore).toBe(80);
    expect(review?.summary).toBe("Chunk 1");
  });

  it("chunks a large PR correctly", async () => {
    const files = Array(200).fill({ filename: "test.ts", changes: 10, additions: 10, deletions: 0, patch: "...", status: "modified" });
    const estimator = new TimeoutEstimatorService();

    let chunksProcessed = 0;
    const processChunk = async (chunk: any[], index: number, total: number) => {
      chunksProcessed++;
      return {
        summary: `Chunk ${index}`,
        overallScore: 90,
        issues: [],
        praise: []
      } as PRReviewResponse;
    };

    const { result, review } = await chunkedReviewService.executeChunkedReview({
      files,
      timeoutEstimator: estimator,
      chunkSize: 50,
      processChunk,
      mode: 'Chunked'
    });

    expect(result.status).toBe('Completed');
    expect(result.reviewedFileCount).toBe(200);
    expect(chunksProcessed).toBe(4);
    expect(review?.overallScore).toBe(90);
    expect(review?.summary).toContain("Chunk 1");
    expect(review?.summary).toContain("Chunk 4");
  });

  it("bails early when time limit is reached", async () => {
    const files = Array(300).fill({ filename: "test.ts", changes: 10, additions: 10, deletions: 0, patch: "...", status: "modified" });
    const estimator = new TimeoutEstimatorService();
    
    let checks = 0;
    estimator.isTimeExhausted = jest.fn().mockImplementation(() => {
      checks++;
      return checks > 1; // 1st check false, 2nd check true
    });

    let chunksProcessed = 0;
    const processChunk = async (chunk: any[], index: number, total: number) => {
      chunksProcessed++;
      return {
        summary: `Finished chunk ${index}`,
        overallScore: 70,
        issues: [],
        praise: []
      } as PRReviewResponse;
    };

    const { result, review } = await chunkedReviewService.executeChunkedReview({
      files,
      timeoutEstimator: estimator,
      chunkSize: 100,
      processChunk,
      mode: 'Degraded'
    });

    expect(chunksProcessed).toBe(1);
    expect(result.status).toBe('Partial');
    expect(result.reviewedFileCount).toBe(100);
    expect(review?.summary).toContain("[PARTIAL REVIEW]");
  });
});
