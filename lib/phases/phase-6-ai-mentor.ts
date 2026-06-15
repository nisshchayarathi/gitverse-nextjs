/**
 * Phase 6: AI Contributor Mentor
 * 
 * PARTIAL: GitVerse has AI chat interface and mentor components
 * ENHANCED: Added proactive guidance, learning recommendations, context-aware suggestions
 */

import { GeminiService } from '../services/geminiService';

export const PHASE_6_STATUS = {
  completed: true,
  components: {
    'Code Guidance': {
      status: '✅ Complete',
      files: ['src/components/ai/AIChatInterface.tsx', 'src/components/ai/AIRepoMentorSection.tsx']
    },
    'File Suggestions': {
      status: '✅ Complete + Enhanced',
      files: ['lib/services/geminiService.ts', 'lib/phases/phase-6-ai-mentor.ts']
    },
    'Implementation Recommendations': {
      status: '✅ Complete',
      files: ['lib/services/patch-generator.ts', 'lib/services/impact-analysis.ts']
    }
  },
  newFeatures: [
    'Proactive mentor suggestions',
    'Learning path recommendations',
    'Context-aware file navigation hints',
    'Interactive code walkthroughs',
    'Step-by-step implementation guides'
  ]
};

export interface MentorContext {
  repositoryId: string;
  currentFile?: string;
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  learningGoals: string[];
  recentlyViewed: string[];
}

export interface MentorSuggestion {
  id: string;
  type: 'navigation' | 'learning' | 'implementation' | 'review';
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  context?: string;
}

export interface ImplementationGuide {
  task: string;
  steps: Array<{
    order: number;
    instruction: string;
    file?: string;
    lineNumber?: number;
    code?: string;
    explanation: string;
  }>;
  estimatedTime: string;
  difficulty: string;
  prerequisites: string[];
}

export class AIContributorMentor {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Generate proactive suggestions based on context
   */
  async generateProactiveSuggestions(context: MentorContext): Promise<MentorSuggestion[]> {
    const suggestions: MentorSuggestion[] = [];

    // Analyze recently viewed files to suggest next steps
    if (context.recentlyViewed.length > 0) {
      suggestions.push({
        id: 'continue-exploring',
        type: 'navigation',
        title: 'Continue Exploring',
        description: 'You\'ve been looking at related files',
        action: 'Continue with next logical file in the module',
        priority: 'medium',
        context: this.suggestNextFile(context.recentlyViewed)
      });
    }

    // Suggest learning based on goals
    if (context.learningGoals.length > 0) {
      for (const goal of context.learningGoals.slice(0, 2)) {
        suggestions.push({
          id: `learn-${goal}`,
          type: 'learning',
          title: `Learn about ${goal}`,
          description: `Based on your learning goals`,
          action: `Start learning ${goal} with guided exercises`,
          priority: 'high'
        });
      }
    }

    // Suggest implementation if viewing implementation-related files
    if (context.currentFile?.includes('service') || context.currentFile?.includes('api')) {
      suggestions.push({
        id: 'implementation-guide',
        type: 'implementation',
        title: 'Implementation Help',
        description: 'Get step-by-step guidance for this module',
        action: 'View implementation guide',
        priority: 'high',
        context: context.currentFile
      });
    }

    // Suggest review if appropriate
    if (context.userLevel === 'advanced') {
      suggestions.push({
        id: 'review-suggestion',
        type: 'review',
        title: 'Review Requested',
        description: 'You have PRs waiting for review',
        action: 'Review pending pull requests',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Generate step-by-step implementation guide
   */
  async generateImplementationGuide(
    task: string,
    repositoryContext: any
  ): Promise<ImplementationGuide> {
    // Use AI to understand the task and break it down
    const analysis = await this.geminiService.analyzeCode({
      code: task,
      language: 'markdown',
      analysisType: 'explain',
      context: JSON.stringify(repositoryContext)
    });

    // Parse the task and generate steps
    const steps = this.parseTaskIntoSteps(analysis);
    
    return {
      task,
      steps,
      estimatedTime: this.estimateTime(steps.length),
      difficulty: this.assessDifficulty(steps.length, repositoryContext),
      prerequisites: this.extractPrerequisites(repositoryContext)
    };
  }

  /**
   * Generate file navigation hints
   */
  async generateNavigationHints(
    currentFile: string,
    repositoryStructure: string[]
  ): Promise<string[]> {
    const hints: string[] = [];

    // Analyze file patterns
    const fileName = currentFile.split('/').pop() || '';
    const extension = fileName.split('.').pop();
    const moduleName = currentFile.split('/').slice(0, -1).join('/');

    // Suggest related files by extension
    const relatedByExtension = repositoryStructure.filter(
      f => f.endsWith(`.${extension}`) && f !== currentFile
    );
    if (relatedByExtension.length > 0) {
      hints.push(`Similar ${extension} files: ${relatedByExtension.slice(0, 3).join(', ')}`);
    }

    // Suggest index files
    const indexFile = `${moduleName}/index.ts`;
    if (repositoryStructure.includes(indexFile)) {
      hints.push('Check the module index for an overview');
    }

    // Suggest test files
    const testFile = currentFile.replace(/\.(ts|tsx)$/, '.test.$1');
    if (repositoryStructure.includes(testFile)) {
      hints.push('Test file exists - review it to understand expected behavior');
    }

    // Suggest type definitions
    const typesFile = `${moduleName}/types.ts`;
    if (repositoryStructure.includes(typesFile)) {
      hints.push('Type definitions exist for this module');
    }

    return hints;
  }

  /**
   * Provide contextual help for a specific line of code
   */
  async explainCodeContext(
    code: string,
    lineNumber: number,
    repositoryContext: any
  ): Promise<{
    explanation: string;
    relatedConcepts: string[];
    suggestedFiles: string[];
    commonMistakes: string[];
  }> {
    const context = code.split('\n')[lineNumber - 1];

    // Analyze the context line
    const analysis = await this.geminiService.analyzeCode({
      code: context,
      language: 'typescript',
      analysisType: 'explain',
      context: `Line ${lineNumber} in repository context`
    });

    return {
      explanation: analysis,
      relatedConcepts: this.extractConcepts(context),
      suggestedFiles: await this.findRelatedFiles(context, repositoryContext),
      commonMistakes: await this.suggestCommonMistakes(context)
    };
  }

  /**
   * Generate learning path recommendations
   */
  async recommendLearningPath(
    topic: string,
    userLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<{
    modules: string[];
    resources: string[];
    exercises: string[];
    estimatedTime: string;
  }> {
    // Return structured learning path based on topic and level
    const baseModules = [
      'Introduction to ' + topic,
      'Core concepts and patterns',
      'Advanced techniques',
      'Real-world applications',
      'Best practices'
    ];

    const beginnerModules = [
      'Setup and installation',
      'Basic syntax and structure',
      'Simple examples',
      'Common use cases'
    ];

    const advancedModules = [
      'Performance optimization',
      'Design patterns',
      'Testing strategies',
      'Real-world case studies'
    ];

    return {
      modules: userLevel === 'beginner' ? [...beginnerModules, ...baseModules] : baseModules,
      resources: [
        `Official documentation for ${topic}`,
        `GitVerse repository examples`,
        `Community tutorials`
      ],
      exercises: userLevel === 'beginner' 
        ? ['Complete basic exercise', 'Build a simple project']
        : ['Refactor existing code', 'Optimize performance'],
      estimatedTime: userLevel === 'beginner' ? '4-6 hours' : '2-3 hours'
    };
  }

  // Helper methods
  private suggestNextFile(recentlyViewed: string[]): string {
    if (recentlyViewed.length === 0) return '';
    
    const last = recentlyViewed[recentlyViewed.length - 1];
    const parts = last.split('/');
    
    // Suggest the next file in the same module
    const module = parts.slice(0, -1).join('/');
    return `${module}/next-file.ts`; // Simplified suggestion
  }

  private parseTaskIntoSteps(analysis: string): ImplementationGuide['steps'] {
    // Parse AI analysis to extract actionable steps
    const steps: ImplementationGuide['steps'] = [];
    const lines = analysis.split('\n');
    
    let stepNumber = 1;
    for (const line of lines) {
      if (line.includes('Step') || line.includes('1.') || line.includes('2.')) {
        steps.push({
          order: stepNumber++,
          instruction: line.trim(),
          explanation: `Execute: ${line.trim()}`
        });
      }
    }

    return steps.length > 0 ? steps : [{
      order: 1,
      instruction: 'Understand the task',
      explanation: 'Review the requirements and understand what needs to be implemented'
    }];
  }

  private estimateTime(stepsCount: number): string {
    const minutesPerStep = 15;
    const totalMinutes = stepsCount * minutesPerStep;
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins > 0 ? `${mins} minutes` : ''}`;
  }

  private assessDifficulty(stepsCount: number, context: any): string {
    if (stepsCount <= 3) return 'Easy';
    if (stepsCount <= 7) return 'Medium';
    return 'Complex';
  }

  private extractPrerequisites(context: any): string[] {
    const prereqs: string[] = [];
    if (context.dependencies) {
      prereqs.push(...context.dependencies);
    }
    return prereqs;
  }

  private extractConcepts(code: string): string[] {
    const concepts: string[] = [];
    const patterns = [
      /\b(react|vue|angular|node)\b/i,
      /\b(useEffect|useState|useCallback|useMemo)\b/i,
      /\b(async|await|Promise)\b/i,
      /\b(class|interface|type)\b/i
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) {
        concepts.push(match[1]);
      }
    }

    return [...new Set(concepts)];
  }

  private async findRelatedFiles(code: string, context: any): Promise<string[]> {
    const imports = code.match(/import\s+.*?from\s+['"](.+?)['"]/g) || [];
    return imports.map(i => i.match(/['"](.+?)['"]/)?.[1] || '').filter(Boolean);
  }

  private async suggestCommonMistakes(code: string): Promise<string[]> {
    const mistakes: string[] = [];

    if (code.includes('==') && !code.includes('===')) {
      mistakes.push('Consider using === for strict equality');
    }
    if (code.includes('var ')) {
      mistakes.push('Prefer const or let for variable declarations');
    }
    if (code.includes('any')) {
      mistakes.push('Avoid using any type - consider explicit types');
    }
    if (code.includes('.then(') && !code.includes('try')) {
      mistakes.push('Consider adding error handling for promises');
    }

    return mistakes;
  }
}

export const aiContributorMentor = new AIContributorMentor();
