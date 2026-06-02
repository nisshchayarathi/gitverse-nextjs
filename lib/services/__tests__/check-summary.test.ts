import { CheckSummaryService } from "../check-summary";
import { FinalPolicyOutput } from "../../../types/github-checks";

describe("CheckSummaryService", () => {
  describe("generateSummary", () => {
    it("should generate success summary for passing policy", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "success",
        reason: "All checks passed",
        evaluations: [
          {
            category: "ai_review",
            status: "PASS",
            message: "",
          },
          {
            category: "secret_scanning",
            status: "PASS",
            message: "",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.title).toBe("GitVerse Security & Compliance Passed");
      expect(result.summary).toBe("All checks passed");
      expect(result.text).toContain("## GitVerse Compliance Report");
      expect(result.text).toContain("✅ Merge Allowed");
    });

    it("should generate failure summary for blocking policy", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "failure",
        reason: "Security violations detected",
        evaluations: [
          {
            category: "secret_scanning",
            status: "FAIL",
            message: "Secret detected in code",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.title).toBe("GitVerse Security & Compliance Blocked");
      expect(result.summary).toBe("Security violations detected");
      expect(result.text).toContain("❌ Merge Blocked");
      expect(result.text).toContain("**Reason:**");
      expect(result.text).toContain("Security violations detected");
    });

    it("should handle warn status in evaluations", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "success",
        reason: "Warnings present but merge allowed",
        evaluations: [
          {
            category: "dependency_security",
            status: "WARN",
            message: "Outdated dependency detected",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.text).toContain("⚠️ Warning");
      expect(result.text).toContain("Outdated dependency detected");
    });

    it("should format category names with proper capitalization", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "success",
        reason: "OK",
        evaluations: [
          {
            category: "ai_review",
            status: "PASS",
            message: "",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.text).toContain("### Ai Review");
    });

    it("should handle action_required status", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "action_required",
        reason: "Manual review needed",
        evaluations: [
          {
            category: "organization_policies",
            status: "FAIL",
            message: "Policy violation",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.title).toBe("GitVerse Security & Compliance Blocked");
      expect(result.text).toContain("### Final Result");
      expect(result.text).toContain("❌ Merge Blocked");
    });

    it("should not show message for PASS status", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "success",
        reason: "OK",
        evaluations: [
          {
            category: "blackout_window",
            status: "PASS",
            message: "This should not appear",
          },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.text).not.toContain("This should not appear");
    });

    it("should handle multiple evaluations", () => {
      const policyOutput: FinalPolicyOutput = {
        status: "success",
        reason: "All checks passed",
        evaluations: [
          { category: "ai_review", status: "PASS", message: "" },
          { category: "secret_scanning", status: "PASS", message: "" },
          { category: "dependency_security", status: "PASS", message: "" },
          { category: "blackout_window", status: "PASS", message: "" },
          { category: "organization_policies", status: "PASS", message: "" },
        ],
      };

      const result = CheckSummaryService.generateSummary(policyOutput);

      expect(result.text).toContain("### Ai Review");
      expect(result.text).toContain("### Secret Scanning");
      expect(result.text).toContain("### Dependency Security");
      expect(result.text).toContain("### Blackout Window");
      expect(result.text).toContain("### Organization Policies");
    });
  });
});
