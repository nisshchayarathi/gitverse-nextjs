import { RevocationConfig } from "../../types/secret-remediation";

export class TokenRevocation {
  private static mockConfigList: RevocationConfig[] = [
    { provider: "GitHub", allowAutoRevoke: false, adminApproved: false },
    { provider: "AWS", allowAutoRevoke: false, adminApproved: false },
    { provider: "Stripe", allowAutoRevoke: false, adminApproved: false },
  ];

  /**
   * Safe helper to mask credentials.
   */
  public static maskSecret(secret: string): string {
    if (!secret) return "";
    if (secret.length <= 8) return "************";
    const prefix = secret.slice(0, 8);
    return `${prefix}****************`;
  }

  /**
   * Attempts to trigger token revocation for a given provider.
   * Enforces that revocation is configurable, opt-in, and explicitly approved.
   */
  public static async requestRevocation(
    provider: string,
    secret: string,
    configOverride?: Partial<RevocationConfig>
  ): Promise<{ success: boolean; actionTaken: string; log: string }> {
    const config = this.mockConfigList.find(c => c.provider.toLowerCase() === provider.toLowerCase()) || {
      provider,
      allowAutoRevoke: false,
      adminApproved: false,
    };

    const finalConfig = { ...config, ...configOverride };
    const masked = this.maskSecret(secret);

    // 1. Audit Logging
    console.warn(`[SECURITY AUDIT] Credential revocation requested for provider: ${provider} (Secret: ${masked})`);

    // 2. Strict Check for Opt-in and Approval
    if (!finalConfig.allowAutoRevoke || !finalConfig.adminApproved) {
      const reason = `Automatic token revocation is blocked. Revocation must be configurable and requires explicit admin/repository approval.`;
      console.warn(`[SECURITY AUDIT] Revocation BLOCKED for ${provider}: ${reason}`);
      return {
        success: false,
        actionTaken: "RECOMMEND_REVOCATION",
        log: `[WARNING] ${reason} Action required: Manually rotate the credential in the ${provider} console immediately.`,
      };
    }

    // 3. Simulated/Mock Revocation Flow upon explicit approval
    const log = `[SUCCESS] Token revocation initiated successfully for approved ${provider} credential.`;
    console.error(`[SECURITY AUDIT] [SUCCESS] Revoked exposed token ${masked} on ${provider}.`);
    
    return {
      success: true,
      actionTaken: "REVOKED",
      log,
    };
  }

  /**
   * Configures revocation settings for a provider.
   */
  public static configureProvider(provider: string, allowAutoRevoke: boolean, adminApproved: boolean): void {
    const idx = this.mockConfigList.findIndex(c => c.provider.toLowerCase() === provider.toLowerCase());
    if (idx !== -1) {
      this.mockConfigList[idx] = { provider, allowAutoRevoke, adminApproved };
    } else {
      this.mockConfigList.push({ provider, allowAutoRevoke, adminApproved });
    }
  }
}
