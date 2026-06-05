import { SecretFinding, RemediationWorkflow, SecretProvider } from "../../types/secret-remediation";
import { TokenRevocation } from "./token-revocation";

export class SecretRemediationService {
  private static providerMap: Record<SecretProvider, { envVar: string; severity: "critical" | "high" | "medium" | "low" }> = {
    AWS: { envVar: "AWS_SECRET_ACCESS_KEY", severity: "critical" },
    GitHub: { envVar: "GITHUB_TOKEN", severity: "critical" },
    Stripe: { envVar: "STRIPE_SECRET_KEY", severity: "critical" },
    SendGrid: { envVar: "SENDGRID_API_KEY", severity: "high" },
    Twilio: { envVar: "TWILIO_AUTH_TOKEN", severity: "high" },
    DatabaseURL: { envVar: "DATABASE_URL", severity: "critical" },
    Generic: { envVar: "GENERIC_API_KEY", severity: "medium" },
  };

  /**
   * Classifies an raw secret pattern, determining provider, severity, and confidence score.
   */
  public static classify(secret: string, filePath: string, line: number): SecretFinding {
    let provider: SecretProvider = "Generic";
    let confidence = 0.8;

    if (/A3T[A-Z0-9]|AKIA[A-Z0-9]/i.test(secret)) {
      provider = "AWS";
      confidence = 0.95;
    } else if (/ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/i.test(secret)) {
      provider = "GitHub";
      confidence = 0.98;
    } else if (/sk_live_[0-9a-zA-Z]{24}/i.test(secret)) {
      provider = "Stripe";
      confidence = 0.99;
    } else if (/SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/i.test(secret)) {
      provider = "SendGrid";
      confidence = 0.95;
    } else if (/AC[a-f0-9]{32}/i.test(secret)) {
      provider = "Twilio";
      confidence = 0.9;
    } else if (/postgres:\/\/|mongodb\+srv:\/\//i.test(secret)) {
      provider = "DatabaseURL";
      confidence = 0.95;
    }

    const mapping = this.providerMap[provider];

    return {
      provider,
      severity: mapping.severity,
      confidence,
      rawSecret: secret,
      filePath,
      line,
    };
  }

  /**
   * AI-Powered code fix and replacement generator.
   */
  public static async generateWorkflow(finding: SecretFinding): Promise<RemediationWorkflow> {
    const mapping = this.providerMap[finding.provider];
    const envVarName = mapping.envVar;
    
    // Mask sensitive key for reporting
    const maskedSecret = TokenRevocation.maskSecret(finding.rawSecret);

    // AI Replacement construction
    let secureReplacement = `process.env.${envVarName}`;
    if (finding.filePath.endsWith(".yaml") || finding.filePath.endsWith(".yml")) {
      secureReplacement = `\${${envVarName}}`;
    } else if (finding.filePath.endsWith(".json")) {
      secureReplacement = `"<Set via environment variables>"`;
    }

    const envExampleUpdate = `${envVarName}=your_${finding.provider.toLowerCase()}_key_here`;
    
    const codeDiff = [
      `--- a/${finding.filePath}`,
      `+++ b/${finding.filePath}`,
      `@@ -${finding.line},1 +${finding.line},1 @@`,
      `- const apiKey = "${maskedSecret}";`,
      `+ const apiKey = ${secureReplacement};`
    ].join("\n");

    const migrationGuidance = [
      `1. Open the file \`${finding.filePath}\` at line ${finding.line}.`,
      `2. Replace the hardcoded string "${maskedSecret}" with reference \`${secureReplacement}\`.`,
      `3. Add the key \`${envVarName}\` to your \`.env\` and configuration environments.`,
      `4. Verify that no logs or public repositories contain the historical commits with this raw token.`,
    ].join("\n");

    console.warn(`[SECURITY AUDIT] Remediation generated successfully for ${finding.provider} credential.`);

    return {
      finding,
      secureReplacement,
      envVarName,
      envExampleUpdate,
      codeDiff,
      migrationGuidance,
    };
  }
}
