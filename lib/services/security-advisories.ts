import { SecurityAdvisory, VulnerabilitySeverity } from "../../types/security-upgrade";

export class SecurityAdvisoryService {
  /**
   * Fetch known security advisories for a given package and version.
   * In a real implementation, this would query GitHub GraphQL Security Advisories API or npm audit registry.
   */
  async getAdvisoriesForPackage(packageName: string, currentVersion: string): Promise<SecurityAdvisory[]> {
    const advisories: SecurityAdvisory[] = [];

    // Mocked critical advisory for demonstration
    if (packageName === "lodash" && currentVersion.startsWith("4.17.20")) {
      advisories.push({
        id: "GHSA-p6mc-m468-83gw",
        cveId: "CVE-2021-23337",
        summary: "Command Injection in lodash",
        severity: "critical",
        packageName: "lodash",
        vulnerableVersionRange: "< 4.17.21",
        patchedVersion: "4.17.21",
      });
    }

    if (packageName === "axios" && currentVersion.startsWith("1.5.")) {
       advisories.push({
        id: "GHSA-wf5p-g6vw-rhxx",
        cveId: "CVE-2023-45857",
        summary: "Axios Cross-Site Request Forgery",
        severity: "high",
        packageName: "axios",
        vulnerableVersionRange: "< 1.6.0",
        patchedVersion: "1.6.0",
      });
    }

    return advisories;
  }
}
