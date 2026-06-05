import { PremergePolicyEngine } from "../premerge-policy-engine";
import { CheckSummaryService } from "../check-summary";

describe("Synchronous Pre-Merge Policy Enforcement", () => {
  describe("PremergePolicyEngine", () => {
    it("Scenario 1: Clean PR -> Success", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "secret_scanning", status: "PASS", message: "Clean" });
      engine.addEvaluation({ category: "ai_review", status: "PASS", message: "Clean" });
      
      const result = engine.evaluate();
      expect(result.status).toBe("success");
      expect(result.reason).toBe("All policies passed successfully.");
    });

    it("Scenario 2: Critical secret -> Failure", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "secret_scanning", status: "FAIL", message: "Critical secret found" });
      engine.addEvaluation({ category: "ai_review", status: "PASS", message: "Clean" });
      
      const result = engine.evaluate();
      expect(result.status).toBe("failure");
      expect(result.reason).toBe("Critical secret found");
    });

    it("Scenario 3: Blackout window active -> Failure", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "secret_scanning", status: "PASS", message: "Clean" });
      engine.addEvaluation({ category: "blackout_window", status: "FAIL", message: "Blackout window active" });
      
      const result = engine.evaluate();
      expect(result.status).toBe("failure");
      expect(result.reason).toBe("Blackout window active");
    });

    it("Scenario 5: Policy violation -> Failure", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "organization_policies", status: "FAIL", message: "Org policy violation" });
      
      const result = engine.evaluate();
      expect(result.status).toBe("failure");
      expect(result.reason).toBe("Org policy violation");
    });
  });

  describe("CheckSummaryService", () => {
    it("should format correct markdown output for success", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "ai_review", status: "PASS", message: "Clean" });
      
      const summary = CheckSummaryService.generateSummary(engine.evaluate());
      expect(summary.title).toBe("GitVerse Security & Compliance Passed");
      expect(summary.text).toContain("✅ Passed");
      expect(summary.text).toContain("✅ Merge Allowed");
    });

    it("should format correct markdown output for failure", () => {
      const engine = new PremergePolicyEngine();
      engine.addEvaluation({ category: "secret_scanning", status: "FAIL", message: "Secret leaked" });
      
      const summary = CheckSummaryService.generateSummary(engine.evaluate());
      expect(summary.title).toBe("GitVerse Security & Compliance Blocked");
      expect(summary.text).toContain("❌ Failed");
      expect(summary.text).toContain("Secret leaked");
      expect(summary.text).toContain("❌ Merge Blocked");
    });
  });
});
