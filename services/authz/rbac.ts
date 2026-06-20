import { RepositoryRole } from "../../types/repository-permissions";

export class RBAC {
  private static policyModifyRoles: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN"];
  private static policyReadRoles: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN", "CONTRIBUTOR", "VIEWER"];

  /**
   * Admin-only roles that can modify repository/org settings and billing.
   * This enforces strict RBAC as required by issue #1891.
   */
  private static settingsAdminRoles: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN"];

  /**
   * Verifies if a role has permission to modify repository policies.
   */
  public static canModifyPolicy(role: RepositoryRole): boolean {
    return this.policyModifyRoles.includes(role);
  }

  /**
   * Verifies if a role has permission to read repository policies.
   */
  public static canReadPolicy(role: RepositoryRole): boolean {
    return this.policyReadRoles.includes(role);
  }

  /**
   * Verifies if a role has permission to view repository/org settings.
   * Only admins can view settings to prevent information leakage.
   */
  public static canViewSettings(role: RepositoryRole): boolean {
    return this.settingsAdminRoles.includes(role);
  }

  /**
   * Verifies if a role has permission to modify repository/org settings.
   * Strictly limited to ORG_ADMIN and REPO_ADMIN roles.
   */
  public static canModifySettings(role: RepositoryRole): boolean {
    return this.settingsAdminRoles.includes(role);
  }

  /**
   * Verifies if a role has permission to view billing/quota information.
   * Only admins can access billing data.
   */
  public static canViewBilling(role: RepositoryRole): boolean {
    return this.settingsAdminRoles.includes(role);
  }

  /**
   * Verifies if a role has permission to modify billing/quota settings.
   * Strictly limited to ORG_ADMIN and REPO_ADMIN roles.
   */
  public static canModifyBilling(role: RepositoryRole): boolean {
    return this.settingsAdminRoles.includes(role);
  }
}
