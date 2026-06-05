export type CheckStatus = "queued" | "in_progress" | "completed";

export type CheckConclusion = 
  | "success" 
  | "failure" 
  | "neutral" 
  | "cancelled" 
  | "timed_out" 
  | "action_required" 
  | "skipped";

export interface CheckOutput {
  title: string;
  summary: string;
  text?: string;
}

export interface PolicyEvaluationResult {
  category: "ai_review" | "secret_scanning" | "blackout_window" | "dependency_security" | "organization_policies";
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface FinalPolicyOutput {
  status: "success" | "action_required" | "failure";
  reason: string;
  evaluations: PolicyEvaluationResult[];
}
