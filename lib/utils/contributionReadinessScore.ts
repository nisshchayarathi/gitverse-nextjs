/**
 * Contribution Readiness Score Calculator
 * 
 * Heuristic-based system to calculate module readiness for contribution
 * based on complexity, documentation, testing, and recent activity.
 */

export type ComplexityLevel = 'Low' | 'Medium' | 'High';
export type DocumentationStatus = 'Complete' | 'Partial' | 'Missing';
export type TestCoverageStatus = 'Available' | 'Partial' | 'Missing';
export type ReadinessIndicator = 'Ready' | 'Moderate' | 'Challenging';

export interface ContributionReadinessScore {
  percentage: number;
  indicator: ReadinessIndicator;
  complexity: ComplexityLevel;
  documentation: DocumentationStatus;
  tests: TestCoverageStatus;
  breakdown: {
    complexity: number;
    documentation: number;
    tests: number;
    recentActivity: number;
  };
}

interface FileData {
  path: string;
  name: string;
  size?: number;
  lines?: number;
  extension?: string;
  language?: string;
}

interface FileChanges {
  path: string;
  additions?: number;
  deletions?: number;
}

interface CommitData {
  hash?: string;
  message?: string;
  createdAt?: string;
  timestamp?: number;
  fileChanges?: FileChanges[];
}

interface RepositoryData {
  files?: FileData[];
  commits?: CommitData[];
}

/**
 * Determine complexity level based on file size and line count
 */
function determineComplexity(file: FileData, repository: RepositoryData): ComplexityLevel {
  const lines = file.lines || 0;
  
  // High complexity: > 500 lines
  if (lines > 500) return 'High';
  
  // Medium complexity: 200-500 lines
  if (lines >= 200) return 'Medium';
  
  // Low complexity: < 200 lines
  return 'Low';
}

/**
 * Determine documentation status
 * Checks for nearby documentation files and estimated comment density
 */
function determineDocumentation(file: FileData, repository: RepositoryData): DocumentationStatus {
  const directory = file.path.substring(0, file.path.lastIndexOf('/'));
  
  // Look for documentation files in the same or parent directories
  const hasDocumentation = repository.files?.some(f => {
    const isInSameDir = f.path.startsWith(directory);
    const isReadme = f.name.toUpperCase().includes('README');
    const isDoc = f.name.endsWith('.md') || f.name.endsWith('.txt');
    return isInSameDir && (isReadme || isDoc);
  }) || false;
  
  // Check for potential inline documentation
  // TypeScript/JavaScript files with good structure often have documentation
  const hasProperExtension = ['ts', 'tsx', 'js', 'jsx'].includes(
    file.extension?.toLowerCase() || ''
  );
  
  if (hasDocumentation && hasProperExtension) return 'Complete';
  if (hasDocumentation || hasProperExtension) return 'Partial';
  
  return 'Missing';
}

/**
 * Determine test coverage status
 * Checks for related test files
 */
function determineTestCoverage(file: FileData, repository: RepositoryData): TestCoverageStatus {
  const fileNameWithoutExt = file.name.replace(/\.[^.]*$/, '');
  
  // Look for test files with common naming patterns
  const hasTests = repository.files?.some(f => {
    const testPatterns = [
      `${fileNameWithoutExt}.test.`,
      `${fileNameWithoutExt}.spec.`,
      `__tests__/${fileNameWithoutExt}`,
      `test/${fileNameWithoutExt}`,
      `tests/${fileNameWithoutExt}`,
    ];
    
    return testPatterns.some(pattern => f.path.includes(pattern));
  }) || false;
  
  // Check if file is already a test file
  const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file.name);
  
  if (hasTests || isTestFile) return 'Available';
  
  // Partial: project has tests but not for this specific file
  const hasAnyTests = repository.files?.some(f => 
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f.name)
  ) || false;
  
  if (hasAnyTests) return 'Partial';
  
  return 'Missing';
}

/**
 * Determine if file has recent activity
 */
function hasRecentActivity(file: FileData, repository: RepositoryData): boolean {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const hasRecentCommit = repository.commits?.some(commit => {
    const fileChanged = commit.fileChanges?.some(fc => fc.path === file.path);
    if (!fileChanged) return false;
    
    // Try to parse timestamp
    const commitDate = commit.createdAt ? new Date(commit.createdAt) : null;
    if (commitDate && commitDate > thirtyDaysAgo) return true;
    
    return false;
  }) || false;
  
  return hasRecentCommit;
}

/**
 * Calculate points for complexity
 */
function getComplexityPoints(complexity: ComplexityLevel): number {
  switch (complexity) {
    case 'Low': return 35;
    case 'Medium': return 25;
    case 'High': return 10;
    default: return 0;
  }
}

/**
 * Calculate points for documentation
 */
function getDocumentationPoints(documentation: DocumentationStatus): number {
  switch (documentation) {
    case 'Complete': return 30;
    case 'Partial': return 15;
    case 'Missing': return 0;
    default: return 0;
  }
}

/**
 * Calculate points for tests
 */
function getTestPoints(tests: TestCoverageStatus): number {
  switch (tests) {
    case 'Available': return 25;
    case 'Partial': return 10;
    case 'Missing': return 0;
    default: return 0;
  }
}

/**
 * Calculate points for recent activity
 */
function getActivityPoints(hasRecent: boolean): number {
  return hasRecent ? 10 : 0;
}

/**
 * Convert percentage to readiness indicator
 */
function getIndicator(percentage: number): ReadinessIndicator {
  if (percentage >= 80) return 'Ready';
  if (percentage >= 50) return 'Moderate';
  return 'Challenging';
}

/**
 * Main function to calculate contribution readiness score
 */
export function calculateContributionReadiness(
  file: FileData,
  repository: RepositoryData
): ContributionReadinessScore {
  // Determine attributes
  const complexity = determineComplexity(file, repository);
  const documentation = determineDocumentation(file, repository);
  const tests = determineTestCoverage(file, repository);
  const recent = hasRecentActivity(file, repository);
  
  // Calculate points
  const complexityPoints = getComplexityPoints(complexity);
  const documentationPoints = getDocumentationPoints(documentation);
  const testsPoints = getTestPoints(tests);
  const activityPoints = getActivityPoints(recent);
  
  // Calculate total percentage (capped at 100)
  const total = Math.min(
    100,
    complexityPoints + documentationPoints + testsPoints + activityPoints
  );
  
  return {
    percentage: total,
    indicator: getIndicator(total),
    complexity,
    documentation,
    tests,
    breakdown: {
      complexity: complexityPoints,
      documentation: documentationPoints,
      tests: testsPoints,
      recentActivity: activityPoints,
    },
  };
}

/**
 * Get badge color based on readiness indicator
 */
export function getIndicatorColor(indicator: ReadinessIndicator): string {
  switch (indicator) {
    case 'Ready': return 'text-green-500';
    case 'Moderate': return 'text-yellow-500';
    case 'Challenging': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

/**
 * Get badge background color based on readiness indicator
 */
export function getIndicatorBgColor(indicator: ReadinessIndicator): string {
  switch (indicator) {
    case 'Ready': return 'bg-green-500/10 border-green-500/30';
    case 'Moderate': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'Challenging': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-gray-500/10 border-gray-500/30';
  }
}

/**
 * Get emoji for readiness indicator
 */
export function getIndicatorEmoji(indicator: ReadinessIndicator): string {
  switch (indicator) {
    case 'Ready': return '🟢';
    case 'Moderate': return '🟡';
    case 'Challenging': return '🔴';
    default: return '⚪';
  }
}
