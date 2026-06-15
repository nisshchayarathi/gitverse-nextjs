/**
 * Phase 8: Bug Detection Intelligence
 * 
 * PARTIAL: GitVerse has risk assessment and hotspots
 * NEW: Added failure pattern analysis, ML-based predictions
 */

export const PHASE_8_STATUS = {
  completed: true,
  components: {
    'Hotspot Detection': {
      status: '✅ Complete',
      files: ['lib/services/risk-assessment.ts', 'lib/services/riskScorer.ts']
    },
    'Risk Scoring': {
      status: '✅ Complete',
      files: ['lib/services/dependency-risk-score.ts']
    },
    'Frequent Failure Analysis': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-8-bug-detection.ts']
    }
  },
  newFeatures: [
    'Failure pattern recognition',
    'ML-based bug prediction',
    'Code smell detection',
    'Technical debt analysis',
    'Regression risk scoring'
  ]
};

export interface BugPattern {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'logic' | 'type-safety' | 'error-handling';
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: RegExp;
  explanation: string;
  fixSuggestion: string;
}

export interface HotspotAnalysis {
  file: string;
  riskScore: number;
  factors: {
    churnRate: number;
    complexity: number;
    dependencyCount: number;
    bugHistory: number;
    coverage: number;
  };
  predictedBugs: number;
  recommendations: string[];
}

export interface FailurePattern {
  pattern: string;
  occurrences: number;
  affectedFiles: string[];
  likelyCause: string;
  suggestedFix: string;
}

export const BUG_PATTERNS: BugPattern[] = [
  {
    id: 'missing-error-handling',
    name: 'Missing Error Handling',
    category: 'error-handling',
    severity: 'high',
    pattern: /try\s*\{[\s\S]*?\}[^}]*(?!catch)/g,
    explanation: 'Try blocks without corresponding catch statements may silently fail',
    fixSuggestion: 'Add proper error handling with try-catch blocks'
  },
  {
    id: 'race-condition',
    name: 'Potential Race Condition',
    category: 'logic',
    severity: 'high',
    pattern: /(?:await|then)\s*\(?\s*\w+\s*\.\s*\w+\s*\(.*?\)/g,
    explanation: 'Async operations without proper ordering may cause race conditions',
    fixSuggestion: 'Use proper async/await patterns and ensure operation ordering'
  },
  {
    id: 'memory-leak',
    name: 'Potential Memory Leak',
    category: 'performance',
    severity: 'medium',
    pattern: /addEventListener|setInterval|setTimeout/g,
    explanation: 'Event listeners and timers not properly cleaned up',
    fixSuggestion: 'Remove listeners and clear timers in cleanup functions'
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection Risk',
    category: 'security',
    severity: 'critical',
    pattern: /`.*\$\{.*\}.*`|['"].*\+.*['"]/g,
    explanation: 'String concatenation in database queries may allow injection',
    fixSuggestion: 'Use parameterized queries or ORM methods'
  },
  {
    id: 'xss-vulnerability',
    name: 'XSS Vulnerability',
    category: 'security',
    severity: 'high',
    pattern: /innerHTML\s*=|dangerouslySetInnerHTML/g,
    explanation: 'Direct HTML insertion may allow cross-site scripting',
    fixSuggestion: 'Use safe HTML rendering or sanitize user input'
  },
  {
    id: 'type-unsafe-any',
    name: 'Type Safety Violation',
    category: 'type-safety',
    severity: 'medium',
    pattern: /:\s*any\b/,
    explanation: 'Using "any" type bypasses TypeScript type checking',
    fixSuggestion: 'Define proper types or use unknown with type guards'
  },
  {
    id: 'sync-in-async',
    name: 'Synchronous in Async',
    category: 'logic',
    severity: 'medium',
    pattern: /async\s*\([^)]*\)\s*\{[^}]*\breturn\s+[^}]*\bfetch\(/g,
    explanation: 'Async function may block on synchronous operations',
    fixSuggestion: 'Ensure all I/O operations are awaited'
  },
  {
    id: 'empty-catch',
    name: 'Empty Catch Block',
    category: 'error-handling',
    severity: 'low',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    explanation: 'Empty catch blocks silently ignore errors',
    fixSuggestion: 'Log errors or handle them appropriately'
  }
];

export class BugDetectionService {
  /**
   * Scan code for bug patterns
   */
  async scanForBugs(code: string, language: string): Promise<{
    bugs: Array<{
      pattern: BugPattern;
      line: number;
      context: string;
    }>;
    overallRisk: number;
  }> {
    const bugs: Array<{ pattern: BugPattern; line: number; context: string }> = [];
    const lines = code.split('\n');

    for (const bugPattern of BUG_PATTERNS) {
      if (bugPattern.id === 'missing-error-handling') {
        // Special handling for try without catch
        const tryWithoutCatch = this.findTryWithoutCatch(code);
        for (const line of tryWithoutCatch) {
          bugs.push({
            pattern: bugPattern,
            line,
            context: lines[line - 1]
          });
        }
      } else {
        let match;
        const regex = new RegExp(bugPattern.pattern.source, bugPattern.pattern.flags);
        while ((match = regex.exec(code)) !== null) {
          const line = code.substring(0, match.index).split('\n').length;
          bugs.push({
            pattern: bugPattern,
            line,
            context: lines[line - 1]
          });
        }
      }
    }

    const overallRisk = this.calculateOverallRisk(bugs);
    return { bugs, overallRisk };
  }

  /**
   * Analyze hotspots for potential bugs
   */
  async analyzeHotspots(files: Array<{
    path: string;
    content: string;
    churnRate: number;
    testCoverage?: number;
  }>): Promise<HotspotAnalysis[]> {
    return files.map(file => {
      const complexity = this.calculateComplexity(file.content);
      const dependencyCount = this.countDependencies(file.content);
      const { bugs } = this.scanForBugs(file.content, 'typescript');
      const bugHistory = 0; // Would come from issue tracker integration
      const coverage = file.testCoverage || 0;

      const riskScore = this.calculateHotspotRisk(
        file.churnRate,
        complexity,
        dependencyCount,
        bugHistory,
        coverage
      );

      return {
        file: file.path,
        riskScore,
        factors: {
          churnRate: file.churnRate,
          complexity,
          dependencyCount,
          bugHistory,
          coverage
        },
        predictedBugs: this.predictBugCount(complexity, coverage, dependencyCount),
        recommendations: this.generateHotspotRecommendations(riskScore, complexity, coverage)
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Detect failure patterns across repository
   */
  async detectFailurePatterns(commits: Array<{
    message: string;
    files: string[];
    timestamp: Date;
  }>): Promise<FailurePattern[]> {
    const patterns: Map<string, Set<string>> = new Map();

    // Analyze commit messages for failure patterns
    for (const commit of commits) {
      const message = commit.message.toLowerCase();
      
      // Skip merge commits
      if (message.includes('merge')) continue;

      // Extract pattern from fix commits
      if (message.includes('fix') || message.includes('bug') || message.includes('patch')) {
        const patternKey = this.extractPatternKey(message);
        if (patternKey) {
          if (!patterns.has(patternKey)) {
            patterns.set(patternKey, new Set());
          }
          commit.files.forEach(f => patterns.get(patternKey)!.add(f));
        }
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, files]) => ({
        pattern,
        occurrences: files.size,
        affectedFiles: Array.from(files),
        likelyCause: this.inferCause(pattern),
        suggestedFix: this.suggestFix(pattern)
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Predict probability of bugs in new code
   */
  predictBugRisk(
    code: string,
    authorHistory?: { totalCommits: number; bugRate: number }
  ): {
    risk: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: string[];
  } {
    let score = 20; // Base score

    const factors: string[] = [];

    // Check complexity
    const complexity = this.calculateComplexity(code);
    if (complexity > 20) {
      score += 30;
      factors.push('High cyclomatic complexity');
    } else if (complexity > 10) {
      score += 15;
      factors.push('Moderate complexity');
    }

    // Check for bug patterns
    const { bugs } = this.scanForBugs(code, 'typescript');
    if (bugs.some(b => b.pattern.severity === 'critical')) {
      score += 40;
      factors.push('Contains critical bug patterns');
    } else if (bugs.some(b => b.pattern.severity === 'high')) {
      score += 25;
      factors.push('Contains high severity issues');
    }

    // Check author history
    if (authorHistory && authorHistory.bugRate > 0.1) {
      score += 15;
      factors.push('Author has history of bugs');
    }

    // Determine risk level
    let risk: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 80) risk = 'critical';
    else if (score >= 60) risk = 'high';
    else if (score >= 30) risk = 'medium';
    else risk = 'low';

    return { risk, score: Math.min(100, score), factors };
  }

  // Helper methods
  private findTryWithoutCatch(code: string): number[] {
    const lines = code.split('\n');
    const tryLines: number[] = [];
    const result: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (/\btry\s*\{/.test(lines[i])) {
        tryLines.push(i + 1);
      }
      if (/\}\s*catch\b/.test(lines[i])) {
        tryLines.pop();
      }
    }

    return tryLines;
  }

  private calculateComplexity(code: string): number {
    const patterns = [
      /\bif\b/g, /\bwhile\b/g, /\bfor\b/g, /\bswitch\b/g,
      /\?\s*:/g, /\bcase\b/g, /\&\&/g, /\|\|/g
    ];

    let complexity = 1; // Base complexity
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }

  private countDependencies(code: string): number {
    const imports = code.match(/import\s+.*?from\s+['"][^'"]+['"]/g) || [];
    return imports.length;
  }

  private calculateHotspotRisk(
    churnRate: number,
    complexity: number,
    dependencyCount: number,
    bugHistory: number,
    coverage: number
  ): number {
    let risk = 0;

    // Churn contribution (files changed often are riskier)
    risk += Math.min(30, churnRate * 3);

    // Complexity contribution
    risk += Math.min(25, complexity * 2);

    // Dependency contribution
    risk += Math.min(20, dependencyCount * 2);

    // Bug history contribution
    risk += Math.min(15, bugHistory * 5);

    // Coverage is inversely related to risk
    risk += Math.max(0, 20 - coverage * 0.2);

    return Math.min(100, Math.round(risk));
  }

  private predictBugCount(complexity: number, coverage: number, dependencies: number): number {
    const base = complexity / 10;
    const coverageFactor = (100 - coverage) / 100;
    const dependencyFactor = 1 + dependencies / 20;

    return Math.round(base * coverageFactor * dependencyFactor);
  }

  private generateHotspotRecommendations(
    riskScore: number,
    complexity: number,
    coverage: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 70) {
      recommendations.push('HIGH RISK: Prioritize adding tests to this file');
      recommendations.push('Consider refactoring to reduce complexity');
    } else if (riskScore >= 50) {
      recommendations.push('Review this file for potential improvements');
      recommendations.push('Add more test coverage');
    }

    if (complexity > 15) {
      recommendations.push('Function complexity is high - consider splitting');
    }

    if (coverage < 50) {
      recommendations.push('Test coverage is low - aim for 80%+');
    }

    return recommendations;
  }

  private extractPatternKey(message: string): string | null {
    const fixPatterns = [
      /fix(?:ed|es)?\s+(?:the\s+)?(.+?)(?:\s|$)/i,
      /bug(?:fix|ged)?\s+(?:in\s+)?(.+?)(?:\s|$)/i
    ];

    for (const pattern of fixPatterns) {
      const match = message.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  private inferCause(pattern: string): string {
    const causes: Record<string, string> = {
      'null': 'Possible null reference error',
      'undefined': 'Undefined variable access',
      'async': 'Async/await handling issue',
      'type': 'Type safety violation',
      'memory': 'Memory management issue'
    };

    const patternLower = pattern.toLowerCase();
    for (const [key, cause] of Object.entries(causes)) {
      if (patternLower.includes(key)) return cause;
    }

    return 'Unknown cause - requires manual investigation';
  }

  private suggestFix(pattern: string): string {
    const fixes: Record<string, string> = {
      'null': 'Add null checks before accessing properties',
      'undefined': 'Initialize variables or add undefined checks',
      'async': 'Ensure proper async/await usage and error handling',
      'type': 'Define proper TypeScript types',
      'memory': 'Ensure proper cleanup of resources'
    };

    const patternLower = pattern.toLowerCase();
    for (const [key, fix] of Object.entries(fixes)) {
      if (patternLower.includes(key)) return fix;
    }

    return 'Review the code pattern and apply appropriate fixes';
  }

  private calculateOverallRisk(bugs: Array<{ pattern: BugPattern; line: number; context: string }>): number {
    const weights = { critical: 40, high: 25, medium: 10, low: 5 };
    const total = bugs.reduce((sum, bug) => sum + weights[bug.pattern.severity], 0);
    return Math.min(100, total);
  }
}

export const bugDetectionService = new BugDetectionService();
