import { SecretRemediationService } from "../../../services/security/secret-remediation-service";
import { TokenRevocation } from "../../../services/security/token-revocation";
import { RemediationReport } from "../../../services/security/remediation-report";
import { RemediationPR } from "../../../services/security/remediation-pr";

describe("AI-Powered Automated Secret Remediation Pipeline", () => {
  describe("Secret Classification & Verification Checks", () => {
    it("Scenario 1: Classifies AWS Access Keys and sets correct severity", () => {
      const awsKey = "AKIAIOSFODNN7EXAMPLE";
      const finding = SecretRemediationService.classify(awsKey, "src/config/aws.ts", 12);

      expect(finding.provider).toBe("AWS");
      expect(finding.severity).toBe("critical");
      expect(finding.confidence).toBeGreaterThanOrEqual(0.9);
      expect(finding.rawSecret).toBe(awsKey);
    });

    it("Scenario 2: Classifies GitHub Personal Access Tokens and sets correct severity", () => {
      const githubToken = "ghp_123456789012345678901234567890123456";
      const finding = SecretRemediationService.classify(githubToken, "scripts/deploy.js", 5);

      expect(finding.provider).toBe("GitHub");
      expect(finding.severity).toBe("critical");
      expect(finding.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("Scenario 3: Classifies Stripe Secret Keys and sets correct severity", () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      const finding = SecretRemediationService.classify(stripeKey, "payment/stripe.ts", 8);

      expect(finding.provider).toBe("Stripe");
      expect(finding.severity).toBe("critical");
      expect(finding.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe("Environment Variable & Code Replacement Checks", () => {
    it("Scenario 4: Generates secure process.env replacements for javascript files", async () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      const finding = SecretRemediationService.classify(stripeKey, "src/index.ts", 15);
      const workflow = await SecretRemediationService.generateWorkflow(finding);

      expect(workflow.envVarName).toBe("STRIPE_SECRET_KEY");
      expect(workflow.secureReplacement).toBe("process.env.STRIPE_SECRET_KEY");
      expect(workflow.envExampleUpdate).toBe("STRIPE_SECRET_KEY=your_stripe_key_here");
      expect(workflow.codeDiff).toContain("+ const apiKey = process.env.STRIPE_SECRET_KEY;");
    });

    it("Scenario 4 (Alt): Generates correct yaml environment interpolations", async () => {
      const awsKey = "AKIAIOSFODNN7EXAMPLE";
      const finding = SecretRemediationService.classify(awsKey, "deploy/config.yaml", 4);
      const workflow = await SecretRemediationService.generateWorkflow(finding);

      expect(workflow.envVarName).toBe("AWS_SECRET_ACCESS_KEY");
      expect(workflow.secureReplacement).toBe("${AWS_SECRET_ACCESS_KEY}");
    });
  });

  describe("Remediation PR & Branch Orchestrations", () => {
    it("Scenario 5: Prepares a hotfix PR branch and formats description report cleanly", async () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      const finding = SecretRemediationService.classify(stripeKey, "src/config.ts", 10);
      const workflow = await SecretRemediationService.generateWorkflow(finding);

      const prDetails = await RemediationPR.preparePR(workflow);

      expect(prDetails.branchName).toContain("security/remediation-");
      expect(prDetails.prTitle).toBe("fix: remediate exposed secret and migrate to environment variable");
      expect(prDetails.prBody).toContain("## Secret Remediation Report");
      expect(prDetails.prBody).toContain("Immediate Rotation Recommended:");
      expect(prDetails.affectedFile).toBe("src/config.ts");
    });

    it("Scenario 5 (Alt): Safely mocks pull request dispatching", async () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      const finding = SecretRemediationService.classify(stripeKey, "src/config.ts", 10);
      const workflow = await SecretRemediationService.generateWorkflow(finding);

      const prResult = await RemediationPR.createPR(workflow);
      expect(prResult.success).toBe(true);
      expect(prResult.prUrl).toContain("https://github.com/remediation/gitverse/pull/");
    });
  });

  describe("Credential Revocation Configuration", () => {
    it("Scenario 6: Defaults to recommending revocation and blocks unauthorized auto-revocation", async () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      
      // Default configurations block automatic credential revocation
      const result = await TokenRevocation.requestRevocation("Stripe", stripeKey);
      
      expect(result.success).toBe(false);
      expect(result.actionTaken).toBe("RECOMMEND_REVOCATION");
      expect(result.log).toContain("Automatic token revocation is blocked");
    });

    it("Scenario 6 (Alt): Executes revocation upon explicit admin approvals", async () => {
      const stripeKey = "sk_live_" + "123456789012345678901234";
      
      // Admin approves revocation in settings
      const result = await TokenRevocation.requestRevocation("Stripe", stripeKey, {
        allowAutoRevoke: true,
        adminApproved: true,
      });

      expect(result.success).toBe(true);
      expect(result.actionTaken).toBe("REVOKED");
      expect(result.log).toContain("Token revocation initiated successfully");
    });
  });
});
