"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyMigratorService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const security_upgrade_1 = require("../../types/security-upgrade");
const api_refactor_1 = require("./api-refactor");
class DependencyMigratorService {
    refactorService = new api_refactor_1.APIRefactorService();
    /**
     * Plans and executes a dependency migration by updating the package version
     * and optionally refactoring affected API usages if there are breaking changes.
     */
    async planAndExecuteMigration(repoPath, scanResult) {
        if (!scanResult.advisory)
            return null;
        const fromVersion = scanResult.currentVersion;
        const toVersion = scanResult.advisory.patchedVersion;
        const upgradeType = this.determineUpgradeType(fromVersion, toVersion);
        const breakingChangesDetected = upgradeType === "major";
        const plan = {
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
            }
            else if (packageJson.devDependencies && packageJson.devDependencies[scanResult.packageName]) {
                packageJson.devDependencies[scanResult.packageName] = `^${toVersion}`;
                updated = true;
            }
            if (updated) {
                await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            }
        }
        catch (e) {
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
                    if (!content)
                        continue;
                    if (content.includes(`"${scanResult.packageName}"`) || content.includes(`'${scanResult.packageName}'`)) {
                        const refactorResult = await this.refactorService.refactorFile(filePath, content, scanResult.packageName, fromVersion, toVersion);
                        if (refactorResult && refactorResult.confidenceScore >= security_upgrade_1.AUTO_PATCH_CONFIDENCE_THRESHOLD) {
                            await fs.writeFile(filePath, refactorResult.newContent);
                            plan.refactoredFiles.push({
                                path: filePath.replace(repoPath, ""),
                                originalContent: content,
                                newContent: refactorResult.newContent,
                                confidenceScore: refactorResult.confidenceScore
                            });
                        }
                        else if (refactorResult) {
                            console.warn(`[DependencyMigrator] Refactoring for ${filePath} had low confidence (${refactorResult.confidenceScore}). Skipping.`);
                        }
                    }
                }
                catch (e) {
                    console.error(`[DependencyMigrator] Error analyzing ${filePath}`, e);
                }
            }
        }
        return plan;
    }
    determineUpgradeType(from, to) {
        const fromParts = from.split(".");
        const toParts = to.split(".");
        if (fromParts[0] !== toParts[0])
            return "major";
        if (fromParts[1] !== toParts[1])
            return "minor";
        return "patch";
    }
}
exports.DependencyMigratorService = DependencyMigratorService;
