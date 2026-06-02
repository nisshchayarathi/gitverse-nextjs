import * as fs from "fs/promises";
import * as path from "path";
import { DependencyScanResult, MigrationPlan, AUTO_PATCH_CONFIDENCE_THRESHOLD } from "../../types/security-upgrade";
import { APIRefactorService } from "./api-refactor";

export class DependencyMigratorService {
  private refactorService = new APIRefactorService();

  /**
   * Plans and executes a dependency migration by updating the package version 
   * and optionally refactoring affected API usages if there are breaking changes.
   */
  async planAndExecuteMigration(
    repoPath: string,
    scanResult: DependencyScanResult
  ): Promise<MigrationPlan | null> {
    if (!scanResult.advisory) return null;

    const fromVersion = scanResult.currentVersion;
    const toVersion = scanResult.advisory.patchedVersion;

    const upgradeType = this.determineUpgradeType(fromVersion, toVersion);
    const breakingChangesDetected = upgradeType === "major";

    const plan: MigrationPlan = {
      packageName: scanResult.packageName,
      fromVersion,
      toVersion,
      upgradeType,
      breakingChangesDetected,
      refactoredFiles: []
    };

    // Update package.json
    try {
      const packageJsonPath = path.join(repoPath, "package.json");
      const packageJsonStr = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonStr);
      
      let updated = false;
      if (packageJson.dependencies && packageJson.dependencies[scanResult.packageName]) {
        packageJson.dependencies[scanResult.packageName] = `^${toVersion}`;
        updated = true;
      } else if (packageJson.devDependencies && packageJson.devDependencies[scanResult.packageName]) {
        packageJson.devDependencies[scanResult.packageName] = `^${toVersion}`;
        updated = true;
      }
      
      if (updated) {
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
    } catch (e) {
      console.error("[DependencyMigrator] Error updating package.json", e);
      return null;
    }

    // Refactor code if it's a major version bump or known breaking change
    if (breakingChangesDetected) {
      const filesToCheck = [
        path.join(repoPath, "src/index.ts"),
        path.join(repoPath, "src/app.ts"),
        path.join(repoPath, "src/utils/api.ts")
      ];

      for (const filePath of filesToCheck) {
        try {
          const content = await fs.readFile(filePath, "utf-8").catch(() => null);
          if (!content) continue;

          if (content.includes(`"${scanResult.packageName}"`) || content.includes(`'${scanResult.packageName}'`)) {
            const refactorResult = await this.refactorService.refactorFile(
              filePath,
              content,
              scanResult.packageName,
              fromVersion,
              toVersion
            );

            if (refactorResult && refactorResult.confidenceScore >= AUTO_PATCH_CONFIDENCE_THRESHOLD) {
              await fs.writeFile(filePath, refactorResult.newContent);
              plan.refactoredFiles.push({
                path: filePath.replace(repoPath, ""),
                originalContent: content,
                newContent: refactorResult.newContent,
                confidenceScore: refactorResult.confidenceScore
              });
            } else if (refactorResult) {
               console.warn(`[DependencyMigrator] Refactoring for ${filePath} had low confidence (${refactorResult.confidenceScore}). Skipping.`);
            }
          }
        } catch (e) {
          console.error(`[DependencyMigrator] Error analyzing ${filePath}`, e);
        }
      }
    }

    return plan;
  }

  private determineUpgradeType(from: string, to: string): "patch" | "minor" | "major" {
    const fromParts = from.split(".");
    const toParts = to.split(".");
    
    if (fromParts[0] !== toParts[0]) return "major";
    if (fromParts[1] !== toParts[1]) return "minor";
    return "patch";
  }
}
