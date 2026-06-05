import { GeneratedIssue, OpportunitySuggestion, DifficultyCategory } from "@/types/generatedIssue";
import { RepositoryFile } from "@/types/firstPRSimulator";
import {
  estimateDifficulty,
  estimateEffortHours,
  categorizeEffort,
} from "@/utils/difficultyEstimator";

const OPPORTUNITY_TEMPLATES = {
  "missing-tests": {
    titleTemplate: "Add tests for {area}",
    descriptionTemplate: `This issue involves improving test coverage for {area}. Tests help ensure code reliability and catch regressions early.`,
    acceptanceCriteriaTemplate: [
      "Add unit tests for the affected files",
      "Achieve at least 80% code coverage for modified files",
      "All tests pass locally and in CI/CD",
      "Tests document the expected behavior",
    ],
    labels: ["good-first-issue", "tests", "help-wanted"],
  },
  "dead-code": {
    titleTemplate: "Remove dead code in {area}",
    descriptionTemplate: `This issue involves identifying and removing unused code in {area}. Cleaning up dead code reduces maintenance burden.`,
    acceptanceCriteriaTemplate: [
      "Identify all unused code paths",
      "Verify no other code depends on the dead code",
      "Remove dead code safely",
      "Update imports if necessary",
      "Run tests to ensure nothing breaks",
    ],
    labels: ["good-first-issue", "cleanup", "refactoring"],
  },
  documentation: {
    titleTemplate: "Improve documentation for {area}",
    descriptionTemplate: `This issue involves creating or improving documentation for {area}. Better docs help new contributors understand the project.`,
    acceptanceCriteriaTemplate: [
      "Create clear, comprehensive documentation",
      "Include code examples where helpful",
      "Document edge cases and limitations",
      "Verify documentation clarity with team review",
      "Link documentation from relevant code",
    ],
    labels: ["good-first-issue", "documentation", "help-wanted"],
  },
  "refactoring": {
    titleTemplate: "Refactor {area} for better maintainability",
    descriptionTemplate: `This issue involves refactoring {area} to improve code quality and maintainability. Smaller, focused functions are easier to test and understand.`,
    acceptanceCriteriaTemplate: [
      "Break down large functions into smaller units",
      "Improve variable naming for clarity",
      "Add comments for complex logic",
      "Maintain existing functionality",
      "All tests pass after refactoring",
    ],
    labels: ["good-first-issue", "refactoring", "technical-debt"],
  },
  "ui-consistency": {
    titleTemplate: "Ensure UI consistency in {area}",
    descriptionTemplate: `This issue involves making UI components in {area} consistent with the design system. Consistency improves user experience.`,
    acceptanceCriteriaTemplate: [
      "Review design system guidelines",
      "Update components to match design system",
      "Test on multiple screen sizes",
      "Verify accessibility standards",
      "Get design review approval",
    ],
    labels: ["good-first-issue", "ui", "design"],
  },
  "type-safety": {
    titleTemplate: "Improve type safety in {area}",
    descriptionTemplate: `This issue involves migrating JavaScript to TypeScript or adding proper type annotations to {area}. Better types prevent runtime errors.`,
    acceptanceCriteriaTemplate: [
      "Migrate files to TypeScript or add type annotations",
      "Resolve all TypeScript errors",
      "Add proper interfaces for data structures",
      "Update tests for type coverage",
      "Verify no 'any' types without justification",
    ],
    labels: ["good-first-issue", "typescript", "technical-debt"],
  },
  "performance": {
    titleTemplate: "Optimize performance in {area}",
    descriptionTemplate: `This issue involves identifying and fixing performance bottlenecks in {area}. Performance improvements enhance user experience.`,
    acceptanceCriteriaTemplate: [
      "Profile code to identify bottlenecks",
      "Implement optimizations",
      "Measure performance improvement",
      "Document performance trade-offs",
      "Verify no regressions in functionality",
    ],
    labels: ["good-first-issue", "performance"],
  },
  "accessibility": {
    titleTemplate: "Improve accessibility in {area}",
    descriptionTemplate: `This issue involves making {area} more accessible to users with disabilities. Accessibility is a key aspect of good UX.`,
    acceptanceCriteriaTemplate: [
      "Audit components for WCAG 2.1 AA compliance",
      "Add proper ARIA labels and roles",
      "Ensure keyboard navigation works",
      "Verify screen reader compatibility",
      "Test with accessibility tools",
    ],
    labels: ["good-first-issue", "accessibility", "help-wanted"],
  },
};

const generateTitle = (opportunity: OpportunitySuggestion): string => {
  const template = OPPORTUNITY_TEMPLATES[opportunity.type as keyof typeof OPPORTUNITY_TEMPLATES];
  if (!template) return opportunity.title;

  const area = opportunity.affectedFiles[0]?.split("/").pop() || "the codebase";
  return template.titleTemplate.replace("{area}", area);
};

const generateDescription = (
  opportunity: OpportunitySuggestion,
  repository?: { name?: string; url?: string }
): string => {
  const template = OPPORTUNITY_TEMPLATES[opportunity.type as keyof typeof OPPORTUNITY_TEMPLATES];
  if (!template) return opportunity.description;

  const area = opportunity.affectedFiles.length > 0
    ? opportunity.affectedFiles.slice(0, 3).join(", ")
    : "the codebase";

  const description = template.descriptionTemplate.replace("{area}", area);

  let fullDescription = `## Summary\n${description}\n\n`;
  fullDescription += `## Context\n${opportunity.reason}\n\n`;

  if (opportunity.affectedFiles.length > 0) {
    fullDescription += `## Affected Files\n${opportunity.affectedFiles
      .slice(0, 10)
      .map((f) => `- \`${f}\``)
      .join("\n")}\n\n`;
  }

  fullDescription += `## Difficulty\n\`${opportunity.difficulty}\` - This is a good task for contributors at this skill level.\n`;

  return fullDescription;
};

const generateAcceptanceCriteria = (opportunity: OpportunitySuggestion): string[] => {
  const template = OPPORTUNITY_TEMPLATES[opportunity.type as keyof typeof OPPORTUNITY_TEMPLATES];
  return template?.acceptanceCriteriaTemplate || [
    "Implement the required changes",
    "Verify solution works as expected",
    "All tests pass",
    "Code follows project conventions",
  ];
};

const generateLabels = (opportunity: OpportunitySuggestion): string[] => {
  const template = OPPORTUNITY_TEMPLATES[opportunity.type as keyof typeof OPPORTUNITY_TEMPLATES];
  const baseLabels = template?.labels || ["good-first-issue", "help-wanted"];

  // Add difficulty label
  switch (opportunity.difficulty) {
    case "Beginner":
      baseLabels.push("difficulty/beginner");
      break;
    case "Intermediate":
      baseLabels.push("difficulty/intermediate");
      break;
    case "Advanced":
      baseLabels.push("difficulty/advanced");
      break;
  }

  return [...new Set(baseLabels)]; // Remove duplicates
};

const generateResources = (opportunity: OpportunitySuggestion, files: RepositoryFile[]): string[] => {
  const resources: string[] = [];

  // Find relevant documentation or guide files
  const docFiles = files
    .filter(
      (f) =>
        /\.md$/.test(f.path || "") ||
        f.path?.includes("docs") ||
        f.name?.includes("GUIDE") ||
        f.name?.includes("README")
    )
    .slice(0, 3);

  if (docFiles.length > 0) {
    resources.push("**Documentation:**");
    docFiles.forEach((f) => {
      resources.push(`- [${f.name || f.path}](${f.path})`);
    });
  }

  // Add general resources based on type
  switch (opportunity.type) {
    case "missing-tests":
      resources.push("**Resources:**");
      resources.push("- Testing best practices guide");
      resources.push("- Test framework documentation");
      break;
    case "type-safety":
      resources.push("**Resources:**");
      resources.push("- TypeScript handbook");
      resources.push("- Type definition guidelines");
      break;
    case "accessibility":
      resources.push("**Resources:**");
      resources.push("- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)");
      resources.push("- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)");
      break;
  }

  return resources;
};

export const generateIssueDraft = (
  opportunity: OpportunitySuggestion,
  files: RepositoryFile[],
  repository?: { name?: string; url?: string }
): GeneratedIssue => {
  const difficulty = opportunity.difficulty;
  const effortHours = estimateEffortHours(opportunity, files);
  const effortCategory = categorizeEffort(effortHours);

  const title = generateTitle(opportunity);
  const description = generateDescription(opportunity, repository);
  const acceptanceCriteria = generateAcceptanceCriteria(opportunity);
  const labels = generateLabels(opportunity);
  const resources = generateResources(opportunity, files);

  // Create a markdown body combining all information
  const body = `${description}

## Acceptance Criteria
${acceptanceCriteria.map((criterion, i) => `${i + 1}. ${criterion}`).join("\n")}

${resources.length > 0 ? `## Resources\n${resources.join("\n")}` : ""}

## Additional Notes
- **Estimated Effort:** ${effortHours} hour${effortHours !== 1 ? "s" : ""}
- **Confidence Score:** ${opportunity.difficulty === "Beginner" ? "High" : opportunity.difficulty === "Intermediate" ? "Medium" : "Standard"}
- **Impact:** Improves code quality and maintainability`;

  return {
    id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description: `${opportunity.description}\n\nThis contributes to: ${opportunity.reason}`,
    body,
    difficulty,
    estimatedEffort: effortCategory,
    estimatedHours: effortHours,
    suggestedLabels: labels,
    affectedFiles: opportunity.affectedFiles,
    acceptanceCriteria,
    resources,
    opportunity,
    confidence: 0.8,
  };
};

export const generateIssueDrafts = (
  opportunities: OpportunitySuggestion[],
  files: RepositoryFile[],
  repository?: { name?: string; url?: string }
): GeneratedIssue[] => {
  return opportunities
    .map((opp) => generateIssueDraft(opp, files, repository))
    .sort((a, b) => {
      // Sort by difficulty (Beginner first) then by confidence
      const difficultyOrder = { Beginner: 0, Intermediate: 1, Advanced: 2 };
      const aDiff = difficultyOrder[a.difficulty];
      const bDiff = difficultyOrder[b.difficulty];
      if (aDiff !== bDiff) return aDiff - bDiff;
      return b.confidence - a.confidence;
    });
};
