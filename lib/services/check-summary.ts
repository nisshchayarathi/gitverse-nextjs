import { FinalPolicyOutput, CheckOutput, PolicyEvaluationResult } from "@/types/github-checks";

export class CheckSummaryService {
  /**
   * Generates a rich Markdown summary of the policy evaluation results
   * for the GitHub Check Run output.
   */
  static generateSummary(policyOutput: FinalPolicyOutput): CheckOutput {
    const isSuccess = policyOutput.status === "success";
    const title = isSuccess ? "GitVerse Security & Compliance Passed" : "GitVerse Security & Compliance Blocked";
    
    let text = "## GitVerse Compliance Report\n\n";

    const formatCategory = (category: string) => {
      return category
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    const getStatusIcon = (status: "PASS" | "WARN" | "FAIL") => {
      switch (status) {
        case "PASS": return "✅ Passed";
        case "WARN": return "⚠️ Warning";
        case "FAIL": return "❌ Failed";
      }
    };

    // Iterate through evaluations and build sections
    for (const evalResult of policyOutput.evaluations) {
      text += `### ${formatCategory(evalResult.category)}\n\n`;
      text += `${getStatusIcon(evalResult.status)}\n\n`;
      if (evalResult.status !== "PASS") {
        text += `${evalResult.message}\n\n`;
      }
    }

    // Final Result Section
    text += `### Final Result\n\n`;
    text += `${isSuccess ? "✅ Merge Allowed" : "❌ Merge Blocked"}\n\n`;
    
    if (!isSuccess) {
      text += `**Reason:**\n${policyOutput.reason}\n`;
    }

    return {
      title,
      summary: policyOutput.reason,
      text,
    };
  }
}
