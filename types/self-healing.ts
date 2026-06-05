import { PRReviewIssue } from "@/lib/services/prReviewService";

export interface SelfHealingPatch {
  issue: PRReviewIssue;
  file: string;
  startLine?: number;
  endLine: number;
  suggestionBody: string; // The exact code to replace with
  explanation: string;
  confidenceScore: number;
  status: "valid" | "invalid_syntax" | "low_confidence";
}

export const SELF_HEAL_MIN_SEVERITY = ["critical", "high"];
export const SELF_HEAL_CONFIDENCE_THRESHOLD = 85;
