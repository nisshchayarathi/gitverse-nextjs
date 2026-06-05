import { PRReviewResponse, PRReviewIssue } from "./prReviewService";

export class ReviewAggregatorService {
  public aggregate(reviews: PRReviewResponse[]): PRReviewResponse {
    const aggregated: PRReviewResponse = {
      summary: "",
      overallScore: 0,
      issues: [],
      praise: []
    };

    if (reviews.length === 0) return aggregated;

    let totalScore = 0;

    for (const review of reviews) {
      if (review.summary) {
        aggregated.summary += review.summary + "\n\n";
      }
      
      totalScore += review.overallScore;

      if (review.issues && review.issues.length > 0) {
        aggregated.issues.push(...review.issues);
      }

      if (review.praise && review.praise.length > 0) {
        aggregated.praise.push(...review.praise);
      }
    }

    aggregated.summary = aggregated.summary.trim();
    aggregated.overallScore = Math.round(totalScore / reviews.length);
    
    // Deduplicate praises
    aggregated.praise = [...new Set(aggregated.praise)].slice(0, 10);

    // Limit issues to max 50 to prevent huge payloads
    aggregated.issues = aggregated.issues.slice(0, 50);

    return aggregated;
  }
}

export const reviewAggregator = new ReviewAggregatorService();
