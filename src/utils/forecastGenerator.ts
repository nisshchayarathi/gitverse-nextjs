/**
 * Forecast Generator Utilities
 * 
 * Generates comprehensive forecasts combining trend analysis,
 * risk prediction, and recommendation generation.
 */

import {
  ForecastRecommendation,
  RiskLevel,
  HotspotForecast,
  RiskIndicator,
} from "@/types/hotspotForecast";

/**
 * Recommendation categories and their typical effort/priority
 */
const RECOMMENDATION_TEMPLATES = {
  REFACTOR: {
    title: "Refactor Module",
    description: "Break down complex functions into smaller, testable units",
    effort: "MEDIUM",
    category: "REFACTOR" as const,
    implementationSteps: [
      "Identify complex functions with high cyclomatic complexity",
      "Extract smaller functions following single responsibility principle",
      "Add unit tests for new functions",
      "Verify backward compatibility",
    ],
  },
  SPLIT_MODULE: {
    title: "Split Module",
    description: "Divide module into smaller, more focused modules",
    effort: "LARGE",
    category: "SPLIT_MODULE" as const,
    implementationSteps: [
      "Analyze module responsibilities",
      "Identify logical boundaries",
      "Create new modules with clear interfaces",
      "Update imports across codebase",
      "Add integration tests",
    ],
  },
  REDUCE_COUPLING: {
    title: "Reduce Dependency Coupling",
    description: "Minimize dependencies between modules",
    effort: "MEDIUM",
    category: "REDUCE_COUPLING" as const,
    implementationSteps: [
      "Map module dependencies",
      "Identify circular dependencies",
      "Introduce abstraction layers/interfaces",
      "Implement dependency injection where appropriate",
      "Test all affected modules",
    ],
  },
  TEST_COVERAGE: {
    title: "Improve Test Coverage",
    description: "Add unit and integration tests for critical paths",
    effort: "MEDIUM",
    category: "TEST_COVERAGE" as const,
    implementationSteps: [
      "Identify critical code paths",
      "Write unit tests for edge cases",
      "Add integration tests",
      "Set up code coverage tracking",
      "Achieve minimum 80% coverage target",
    ],
  },
  ARCHITECTURE: {
    title: "Fix Architectural Issues",
    description: "Align module with repository architecture patterns",
    effort: "LARGE",
    category: "ARCHITECTURE" as const,
    implementationSteps: [
      "Review repository architecture guidelines",
      "Document current vs. desired architecture",
      "Plan migration strategy",
      "Implement changes incrementally",
      "Update documentation",
    ],
  },
  DEPENDENCY_MANAGEMENT: {
    title: "Manage Dependencies",
    description: "Remove unused dependencies and consolidate versions",
    effort: "SMALL",
    category: "DEPENDENCY_MANAGEMENT" as const,
    implementationSteps: [
      "Audit all dependencies",
      "Remove unused packages",
      "Consolidate duplicate dependencies",
      "Update outdated packages",
      "Run full test suite",
    ],
  },
  CODE_CLEANUP: {
    title: "Code Cleanup",
    description: "Remove dead code, obsolete patterns, and technical debt",
    effort: "SMALL",
    category: "CODE_CLEANUP" as const,
    implementationSteps: [
      "Identify dead code with static analysis",
      "Remove unused variables and functions",
      "Clean up outdated comments",
      "Update deprecated patterns",
      "Run tests to verify",
    ],
  },
};

/**
 * Generates recommendations based on risk level and indicators
 */
export function generateRecommendations(
  riskLevel: RiskLevel,
  riskIndicators: RiskIndicator[],
  growthRates: {
    complexity: number;
    dependencies: number;
    churn: number;
  }
): ForecastRecommendation[] {
  const recommendations: ForecastRecommendation[] = [];
  const usedCategories = new Set<string>();

  // Process risk indicators to generate recommendations
  for (const indicator of riskIndicators) {
    if (indicator.name === "High Complexity" && !usedCategories.has("REFACTOR")) {
      recommendations.push(
        createRecommendation("REFACTOR", riskLevel, indicator, 75)
      );
      usedCategories.add("REFACTOR");
    }

    if (
      indicator.name === "High Dependency Count" &&
      !usedCategories.has("REDUCE_COUPLING")
    ) {
      recommendations.push(
        createRecommendation("REDUCE_COUPLING", riskLevel, indicator, 60)
      );
      usedCategories.add("REDUCE_COUPLING");
    }

    if (indicator.name === "High Code Churn" && !usedCategories.has("TEST_COVERAGE")) {
      recommendations.push(
        createRecommendation("TEST_COVERAGE", riskLevel, indicator, 70)
      );
      usedCategories.add("TEST_COVERAGE");
    }

    if (indicator.name === "Large Module" && !usedCategories.has("SPLIT_MODULE")) {
      recommendations.push(
        createRecommendation("SPLIT_MODULE", riskLevel, indicator, 85)
      );
      usedCategories.has("SPLIT_MODULE");
    }

    if (
      indicator.name === "Architectural Drift" &&
      !usedCategories.has("ARCHITECTURE")
    ) {
      recommendations.push(
        createRecommendation("ARCHITECTURE", riskLevel, indicator, 80)
      );
      usedCategories.add("ARCHITECTURE");
    }
  }

  // Add growth-based recommendations
  if (growthRates.complexity > 15 && !usedCategories.has("SPLIT_MODULE")) {
    const deps = riskIndicators.find((r) => r.name === "High Complexity");
    if (deps && !usedCategories.has("SPLIT_MODULE")) {
      recommendations.push(
        createRecommendation("SPLIT_MODULE", riskLevel, deps, 80)
      );
      usedCategories.add("SPLIT_MODULE");
    }
  }

  if (
    growthRates.dependencies > 20 &&
    !usedCategories.has("DEPENDENCY_MANAGEMENT")
  ) {
    const deps = riskIndicators.find((r) => r.name === "High Dependency Count");
    if (deps && !usedCategories.has("DEPENDENCY_MANAGEMENT")) {
      recommendations.push(
        createRecommendation("DEPENDENCY_MANAGEMENT", riskLevel, deps, 65)
      );
      usedCategories.add("DEPENDENCY_MANAGEMENT");
    }
  }

  // Always recommend code cleanup for critical risk
  if (riskLevel === "CRITICAL" && !usedCategories.has("CODE_CLEANUP")) {
    recommendations.push(
      createRecommendation(
        "CODE_CLEANUP",
        riskLevel,
        { name: "General Maintenance", currentValue: 1, threshold: 0, severity: "HIGH", impact: "Technical debt accumulation" },
        50
      )
    );
  }

  // Sort by priority and effort
  recommendations.sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    const effortOrder = {
      TRIVIAL: 0,
      SMALL: 1,
      MEDIUM: 2,
      LARGE: 3,
      VERY_LARGE: 4,
    };
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  return recommendations.slice(0, 5); // Return top 5 recommendations
}

/**
 * Creates a recommendation from template
 */
function createRecommendation(
  templateKey: keyof typeof RECOMMENDATION_TEMPLATES,
  riskLevel: RiskLevel,
  indicator: RiskIndicator,
  expectedImpact: number
): ForecastRecommendation {
  const template = RECOMMENDATION_TEMPLATES[templateKey];
  const priorityMap: Record<RiskLevel, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  };

  const effortMap: Record<string, "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE" | "VERY_LARGE"> = {
    SMALL: "SMALL",
    MEDIUM: "MEDIUM",
    LARGE: "LARGE",
  };

  const riskMap: Record<string, "LOW" | "MEDIUM" | "HIGH"> = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  };

  return {
    id: `${templateKey}-${Date.now()}`,
    title: template.title,
    description: template.description,
    priority: priorityMap[riskLevel],
    category: template.category,
    effort: effortMap[template.effort],
    expectedImpact,
    implementationSteps: template.implementationSteps,
    estimatedTimeToImplement:
      template.effort === "SMALL"
        ? "1-2 days"
        : template.effort === "MEDIUM"
          ? "3-7 days"
          : "1-2 weeks",
    riskOfChange: riskMap[indicator.severity] || "MEDIUM",
    relatedRisks: [indicator.name],
  };
}

/**
 * Estimates effort for implementation
 */
export function estimateImplementationEffort(
  complexity: number,
  dependencies: number,
  moduleSize: number
): "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE" | "VERY_LARGE" {
  const effortScore = complexity * 0.4 + (dependencies / 10) * 0.3 + (moduleSize / 1000) * 0.3;

  if (effortScore < 10) return "TRIVIAL";
  if (effortScore < 25) return "SMALL";
  if (effortScore < 50) return "MEDIUM";
  if (effortScore < 75) return "LARGE";
  return "VERY_LARGE";
}

/**
 * Generates impact analysis for recommendations
 */
export function analyzeRecommendationImpact(
  recommendation: ForecastRecommendation,
  currentMetrics: {
    complexity: number;
    dependencies: number;
    churn: number;
  }
): {
  expectedComplexityReduction: number;
  expectedDependencyReduction: number;
  expectedChurnReduction: number;
  timeToRealize: string;
} {
  const impacts = {
    REFACTOR: { complexity: 20, dependencies: 5, churn: 15, time: "2-3 weeks" },
    SPLIT_MODULE: { complexity: 35, dependencies: 25, churn: 20, time: "4-6 weeks" },
    REDUCE_COUPLING: { complexity: 10, dependencies: 30, churn: 10, time: "2-4 weeks" },
    TEST_COVERAGE: { complexity: 5, dependencies: 0, churn: 25, time: "2-3 weeks" },
    ARCHITECTURE: { complexity: 15, dependencies: 20, churn: 15, time: "6-8 weeks" },
    DEPENDENCY_MANAGEMENT: {
      complexity: 5,
      dependencies: 40,
      churn: 5,
      time: "1-2 weeks",
    },
    CODE_CLEANUP: { complexity: 10, dependencies: 5, churn: 10, time: "1-2 weeks" },
  };

  const impact = impacts[recommendation.category];

  return {
    expectedComplexityReduction: Math.round(
      (currentMetrics.complexity * impact.complexity) / 100
    ),
    expectedDependencyReduction: impact.dependencies,
    expectedChurnReduction: Math.round(
      (currentMetrics.churn * impact.churn) / 100
    ),
    timeToRealize: impact.time,
  };
}

/**
 * Prioritizes recommendations by impact and effort
 */
export function prioritizeRecommendations(
  recommendations: ForecastRecommendation[]
): ForecastRecommendation[] {
  return [...recommendations].sort((a, b) => {
    // Priority points: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1
    const priorityPoints = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    // Effort points: TRIVIAL=1, SMALL=2, MEDIUM=3, LARGE=4, VERY_LARGE=5
    const effortPoints = {
      TRIVIAL: 1,
      SMALL: 2,
      MEDIUM: 3,
      LARGE: 4,
      VERY_LARGE: 5,
    };

    // Score: (priority + expectedImpact) / effort
    const scoreA =
      ((priorityPoints[a.priority] + a.expectedImpact / 20) /
        effortPoints[a.effort]) *
      100;
    const scoreB =
      ((priorityPoints[b.priority] + b.expectedImpact / 20) /
        effortPoints[b.effort]) *
      100;

    return scoreB - scoreA;
  });
}

/**
 * Estimates days until module reaches critical threshold
 */
export function estimateDaysToThreshold(
  currentValue: number,
  growthRate: number, // % per month
  threshold: number
): number {
  if (growthRate <= 0 || currentValue >= threshold) {
    return Infinity;
  }

  // Solve: currentValue * (1 + growthRate/100)^(days/30) = threshold
  const monthsNeeded = Math.log(threshold / currentValue) / Math.log(1 + growthRate / 100);
  return Math.round(monthsNeeded * 30);
}
