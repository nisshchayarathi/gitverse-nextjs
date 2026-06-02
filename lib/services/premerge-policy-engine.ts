import { FinalPolicyOutput, PolicyEvaluationResult } from "@/types/github-checks";

export class PremergePolicyEngine {
  private evaluations: PolicyEvaluationResult[] = [];

  /**
   * Adds an evaluation result to the policy engine context.
   */
  addEvaluation(evaluation: PolicyEvaluationResult): void {
    this.evaluations.push(evaluation);
  }

  /**
   * Processes all added evaluations to determine the final state.
   * If any evaluation is FAIL, the entire check fails.
   */
  evaluate(): FinalPolicyOutput {
    let finalStatus: "success" | "action_required" | "failure" = "success";
    let failureReasons: string[] = [];

    for (const evalResult of this.evaluations) {
      if (evalResult.status === "FAIL") {
        finalStatus = "failure";
        failureReasons.push(evalResult.message);
      } else if (evalResult.status === "WARN" && finalStatus !== "failure") {
        // WARN does not block the merge, but could optionally transition to action_required in strict modes
        // Leaving as success for standard operations as per implementation plan
      }
    }

    let finalReason = "All policies passed successfully.";
    if (finalStatus === "failure") {
      finalReason = failureReasons.join(" | ");
    }

    return {
      status: finalStatus,
      reason: finalReason,
      evaluations: this.evaluations,
    };
  }
}
