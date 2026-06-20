import { DependencyImpact } from "./dependencyGraphAnalyzer";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskScoreResult {
  level: RiskLevel;
  score: number;
  factors: string[];
}

export class RiskScorer {
  public static calculateRisk(changedFiles: string[], impact: DependencyImpact, driftWarnings: string[]): RiskScoreResult {
    let score = 0;
    const factors: string[] = [];

    // Factor 1: Number of changed files
    if (changedFiles.length > 50) {
      score += 30;
      factors.push(`Large number of changed files (${changedFiles.length})`);
    } else if (changedFiles.length > 20) {
      score += 15;
      factors.push(`Moderate number of changed files (${changedFiles.length})`);
    }

    // Factor 2: Downstream dependency impact
    if (impact.downstreamCount > 30) {
      score += 40;
      factors.push(`Extensive downstream impact (${impact.downstreamCount} affected files)`);
    } else if (impact.downstreamCount > 10) {
      score += 20;
      factors.push(`Moderate downstream impact (${impact.downstreamCount} affected files)`);
    }

    // Factor 3: Critical module modification
    const criticalRegex = /auth|security|session|crypto|login/i;
    let authTouched = false;
    const sharedUtilityRegex = /utils?|shared|core|common/i;
    let coreTouched = false;

    for (const file of changedFiles) {
      if (!authTouched && criticalRegex.test(file)) {
        score += 50;
        factors.push(`Authentication/Security module modified (${file})`);
        authTouched = true;
      }
      if (!coreTouched && sharedUtilityRegex.test(file)) {
        score += 25;
        factors.push(`Core utility/shared module modified (${file})`);
        coreTouched = true;
      }
    }

    // Factor 4: Architectural violations/drift
    if (driftWarnings && driftWarnings.length > 0) {
      score += driftWarnings.length * 20;
      factors.push(`Architectural drift detected (${driftWarnings.length} warnings)`);
    }

    // Assign level based on final score
    let level: RiskLevel = "LOW";
    if (score >= 80) level = "CRITICAL";
    else if (score >= 50) level = "HIGH";
    else if (score >= 25) level = "MEDIUM";

    return { level, score, factors };
  }
}
