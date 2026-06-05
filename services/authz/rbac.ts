import { RepositoryRole } from "../../types/repository-permissions";

export class RBAC {
  private static policyModifyRoles: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN"];
  private static policyReadRoles: RepositoryRole[] = ["ORG_ADMIN", "REPO_ADMIN", "CONTRIBUTOR", "VIEWER"];

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
}
