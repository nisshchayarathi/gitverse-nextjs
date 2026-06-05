import { RepositoryFile } from "@/types/firstPRSimulator";
import {
  OpportunitySuggestion,
  OpportunityType,
  RepositoryAnalysisMetrics,
} from "@/types/generatedIssue";

// Detect missing test opportunities
export const detectMissingTests = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];
  const sourceFiles = files.filter((f) =>
    /\.(tsx?|jsx?|py|go|rs|java)$/.test(f.path || "")
  );
  const testFiles = files.filter((f) =>
    /\.(test|spec)\.(tsx?|jsx?|py|go|rs|java)$/.test(f.path || "")
  );

  const testCoverage = sourceFiles.length > 0 ? testFiles.length / sourceFiles.length : 0;

  if (testCoverage < 0.3) {
    opportunities.push({
      type: "missing-tests" as OpportunityType,
      title: "Increase Test Coverage",
      description: `Current test coverage is only ${Math.round(testCoverage * 100)}%. This repository could benefit from more comprehensive test coverage.`,
      affectedFiles: sourceFiles
        .slice(0, 3)
        .map((f) => f.path || "")
        .filter(Boolean),
      reason:
        "Low test coverage indicates many untested code paths. Tests help prevent regressions and document expected behavior.",
      estimatedEffort: testCoverage < 0.1 ? "high" : "medium",
      difficulty: testCoverage < 0.1 ? "Intermediate" : "Beginner",
    });
  }

  return opportunities;
};

// Detect dead code opportunities
export const detectDeadCode = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];
  const unused: string[] = [];
  const orphaned: string[] = [];

  // Simple heuristic: look for utility files with low import counts
  files.forEach((file) => {
    const isUtility =
      file.path?.includes("utils") || file.path?.includes("helpers") || file.path?.includes("lib");
    if (!isUtility) return;

    // Count references from other files
    let referenceCount = 0;
    const fileName = file.name || file.path?.split("/").pop() || "";
    const baseName = fileName.replace(/\.(tsx?|jsx?)$/, "");

    files.forEach((f) => {
      if (f === file) return;
      if (f.imports?.some((imp) => imp.includes(baseName))) {
        referenceCount++;
      }
    });

    if (referenceCount === 0 && isUtility) {
      orphaned.push(file.path || "");
    }
  });

  if (orphaned.length > 0) {
    opportunities.push({
      type: "dead-code" as OpportunityType,
      title: "Remove Dead Code",
      description: `Found ${orphaned.length} potentially unused utility files or helpers that may be dead code.`,
      affectedFiles: orphaned.slice(0, 5),
      reason:
        "Dead code increases maintenance burden, confuses developers, and makes the codebase harder to navigate. Removing it improves code clarity.",
      estimatedEffort: "low",
      difficulty: "Beginner",
    });
  }

  return opportunities;
};

// Detect refactoring opportunities
export const detectRefactoringOpportunities = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];

  // Check for very large files
  const largeFiles = files
    .filter((f) => (f.lines || 0) > 500)
    .sort((a, b) => (b.lines || 0) - (a.lines || 0))
    .slice(0, 3);

  if (largeFiles.length > 0) {
    opportunities.push({
      type: "refactoring" as OpportunityType,
      title: "Refactor Large Files",
      description: `Found ${largeFiles.length} large files that exceed 500 lines. These could benefit from being split into smaller, more focused modules.`,
      affectedFiles: largeFiles.map((f) => f.path || "").filter(Boolean),
      reason:
        "Large files are harder to understand and maintain. Breaking them into smaller, single-purpose modules improves code organization and testability.",
      estimatedEffort: "medium",
      difficulty: "Intermediate",
    });
  }

  // Check for deeply nested imports/dependencies
  const highDependencyFiles = files
    .filter((f) => (f.imports?.length || 0) > 15)
    .slice(0, 2);

  if (highDependencyFiles.length > 0) {
    opportunities.push({
      type: "refactoring" as OpportunityType,
      title: "Reduce File Dependencies",
      description: `Found files with many external dependencies (${Math.max(...(highDependencyFiles.map((f) => f.imports?.length || 0)))}) that could benefit from refactoring.`,
      affectedFiles: highDependencyFiles.map((f) => f.path || "").filter(Boolean),
      reason:
        "Files with many dependencies are harder to test and understand. Reducing dependencies improves code isolation and reusability.",
      estimatedEffort: "medium",
      difficulty: "Intermediate",
    });
  }

  return opportunities;
};

// Detect documentation gaps
export const detectDocumentationGaps = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];

  const codeFiles = files.filter((f) =>
    /\.(tsx?|jsx?|py|go|rs|java)$/.test(f.path || "")
  );

  const docFiles = files.filter(
    (f) =>
      /\.md$/.test(f.path || "") ||
      f.path?.includes("docs") ||
      f.name?.includes("README") ||
      f.name?.includes("CONTRIBUTING")
  );

  const hasMainReadme = files.some((f) => f.name === "README.md" || f.name === "README");
  const hasContributing = files.some((f) => f.name?.includes("CONTRIBUTING"));

  const gaps: string[] = [];
  if (!hasMainReadme) gaps.push("main README.md");
  if (!hasContributing) gaps.push("CONTRIBUTING.md guide");
  if (docFiles.length === 0 && codeFiles.length > 10) gaps.push("comprehensive documentation");

  if (gaps.length > 0) {
    opportunities.push({
      type: "documentation" as OpportunityType,
      title: "Improve Documentation",
      description: `Repository is missing: ${gaps.join(", ")}. Good documentation helps new contributors understand the project.`,
      affectedFiles: [],
      reason:
        "Documentation is crucial for onboarding contributors. Missing docs makes it harder for newcomers to understand and contribute to the project.",
      estimatedEffort: gaps.length > 2 ? "medium" : "low",
      difficulty: "Beginner",
    });
  }

  return opportunities;
};

// Detect type safety issues
export const detectTypeSafetyGaps = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];

  const jsFiles = files.filter((f) => /\.jsx?$/.test(f.path || ""));
  const tsFiles = files.filter((f) => /\.tsx?$/.test(f.path || ""));

  const jsRatio = jsFiles.length / (jsFiles.length + tsFiles.length);

  if (jsRatio > 0.3) {
    const untyped = jsFiles.slice(0, 5);
    opportunities.push({
      type: "type-safety" as OpportunityType,
      title: "Migrate to TypeScript",
      description: `Found ${jsFiles.length} JavaScript files that could be migrated to TypeScript for better type safety.`,
      affectedFiles: untyped.map((f) => f.path || "").filter(Boolean),
      reason:
        "TypeScript provides compile-time type checking that prevents many common errors. Migrating JavaScript files improves code reliability.",
      estimatedEffort: "high",
      difficulty: "Intermediate",
    });
  }

  return opportunities;
};

// Detect UI consistency issues
export const detectUIConsistencyIssues = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  const opportunities: OpportunitySuggestion[] = [];

  const uiFiles = files.filter(
    (f) =>
      f.path?.includes("component") ||
      f.path?.includes("ui/") ||
      /\.(tsx|jsx)$/.test(f.path || "")
  );

  const styleFiles = files.filter(
    (f) =>
      f.path?.includes("style") ||
      f.path?.includes("theme") ||
      /\.(css|scss|less)$/.test(f.path || "")
  );

  if (uiFiles.length > 5 && styleFiles.length < 3) {
    opportunities.push({
      type: "ui-consistency" as OpportunityType,
      title: "Establish UI Consistency",
      description: `Found many UI components (${uiFiles.length}) but few centralized style files. Consider creating a design system.`,
      affectedFiles: uiFiles.slice(0, 3).map((f) => f.path || "").filter(Boolean),
      reason:
        "Consistent UI design improves user experience and reduces maintenance. A centralized design system makes it easier for contributors to maintain consistency.",
      estimatedEffort: "medium",
      difficulty: "Intermediate",
    });
  }

  return opportunities;
};

// Main opportunity detector
export const detectOpportunities = (files: RepositoryFile[]): OpportunitySuggestion[] => {
  if (!files || files.length === 0) return [];

  const opportunities: OpportunitySuggestion[] = [
    ...detectMissingTests(files),
    ...detectDeadCode(files),
    ...detectRefactoringOpportunities(files),
    ...detectDocumentationGaps(files),
    ...detectTypeSafetyGaps(files),
    ...detectUIConsistencyIssues(files),
  ];

  return opportunities;
};
