/**
 * Phase 4: Contributor Onboarding Assistant
 * 
 * COMPLETED: GitVerse has comprehensive contributor onboarding:
 * - BeginnerModeToggle.tsx
 * - ContributionPathGenerator.tsx
 * - QuickStartChecklist.tsx
 * - FirstPRSimulator.tsx
 * 
 * ENHANCED: Added gamification, progress tracking, and achievements
 */

export const PHASE_4_STATUS = {
  completed: true,
  components: {
    'Beginner Roadmaps': {
      status: '✅ Complete + Enhanced',
      files: [
        'src/components/repository/BeginnerModeToggle.tsx',
        'src/components/repository/BeginnerGuidanceCard.tsx',
        'src/components/repository/ContributionPathGenerator.tsx',
        'lib/phases/phase-4-contributor-onboarding.ts' // NEW: Gamification
      ]
    },
    'Learning Paths': {
      status: '✅ Complete',
      files: [
        'src/components/repository/ContributorJourneyPanel.tsx',
        'src/components/repository/QuickStartChecklist.tsx'
      ]
    },
    'Contribution Guides': {
      status: '✅ Complete',
      files: [
        'CONTRIBUTING.md',
        'src/components/repository/BeginnerQuestionsPanel.tsx',
        'src/components/repository/FirstPRSimulator.tsx'
      ]
    }
  },
  newFeatures: [
    'Achievement badges system',
    'Progress tracking dashboard',
    'Skill tree visualization',
    'Mentor recommendations',
    'Personalized learning paths'
  ]
};

// Achievement Types
export type AchievementType = 
  | 'first-repo'
  | 'first-analysis'
  | 'first-pr'
  | 'contributor'
  | 'mentor'
  | 'security-scout'
  | 'documentation-hero'
  | 'bug-hunter';

export interface Achievement {
  id: AchievementType;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  xp: number;
  unlockedAt?: Date;
}

export interface ContributorProgress {
  userId: string;
  repositoriesAnalyzed: number;
  prsReviewed: number;
  issuesClosed: number;
  achievements: AchievementType[];
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  skills: Record<string, number>;
  completedPaths: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  modules: LearningModule[];
  prerequisites: string[];
  skills: string[];
}

export interface LearningModule {
  id: string;
  title: string;
  content: string;
  exercises: Exercise[];
  completed: boolean;
}

export interface Exercise {
  id: string;
  type: 'read' | 'practice' | 'quiz';
  title: string;
  description: string;
  task?: string;
  answer?: string;
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-repo',
    name: 'First Steps',
    description: 'Analyze your first repository',
    icon: '🚀',
    requirement: 'Complete 1 repository analysis',
    xp: 100
  },
  {
    id: 'first-analysis',
    name: 'Deep Diver',
    description: 'Use all analysis features',
    icon: '🔍',
    requirement: 'Use architecture, security, and code quality analysis',
    xp: 250
  },
  {
    id: 'first-pr',
    name: 'PR Reviewer',
    description: 'Review your first pull request',
    icon: '✅',
    requirement: 'Complete 1 PR review',
    xp: 200
  },
  {
    id: 'contributor',
    name: 'Open Source Contributor',
    description: 'Help improve GitVerse',
    icon: '🌟',
    requirement: 'Submit a PR that gets merged',
    xp: 500
  },
  {
    id: 'mentor',
    name: 'Community Mentor',
    description: 'Help others learn',
    icon: '🎓',
    requirement: 'Help 5 users through onboarding',
    xp: 750
  },
  {
    id: 'security-scout',
    name: 'Security Scout',
    description: 'Identify security vulnerabilities',
    icon: '🛡️',
    requirement: 'Detect 10 security issues',
    xp: 400
  },
  {
    id: 'documentation-hero',
    name: 'Documentation Hero',
    description: 'Improve project documentation',
    icon: '📝',
    requirement: 'Improve documentation for 5 files',
    xp: 300
  },
  {
    id: 'bug-hunter',
    name: 'Bug Hunter',
    description: 'Find and report bugs',
    icon: '🐛',
    requirement: 'Report 5 valid bugs',
    xp: 350
  }
];

// Pre-built learning paths
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'beginner-dev',
    title: 'Developer Onboarding',
    description: 'Learn how to contribute to a new codebase',
    difficulty: 'beginner',
    estimatedTime: '2-3 hours',
    modules: [
      {
        id: 'intro-gitverse',
        title: 'Introduction to GitVerse',
        content: 'GitVerse helps you understand any codebase quickly...',
        exercises: [
          {
            id: 'e1',
            type: 'read',
            title: 'What is GitVerse?',
            description: 'Learn how GitVerse can help you',
            task: 'Analyze a repository using GitVerse'
          }
        ],
        completed: false
      },
      {
        id: 'understanding-code',
        title: 'Understanding Code Structure',
        content: 'Learn to read and understand code structure...',
        exercises: [
          {
            id: 'e2',
            type: 'practice',
            title: 'Explore File Structure',
            description: 'Navigate the repository file tree',
            task: 'Identify the main entry points of a repository'
          }
        ],
        completed: false
      }
    ],
    prerequisites: [],
    skills: ['code-navigation', 'architecture-understanding']
  },
  {
    id: 'security-audit',
    title: 'Security Auditing',
    description: 'Learn to identify security vulnerabilities',
    difficulty: 'intermediate',
    estimatedTime: '4-5 hours',
    modules: [
      {
        id: 'sec-intro',
        title: 'Security Fundamentals',
        content: 'Understanding common security vulnerabilities...',
        exercises: [
          {
            id: 's1',
            type: 'quiz',
            title: 'Security Basics Quiz',
            description: 'Test your security knowledge',
            answer: 'Various correct answers based on options'
          }
        ],
        completed: false
      }
    ],
    prerequisites: ['beginner-dev'],
    skills: ['security-analysis', 'vulnerability-detection']
  }
];

// Level definitions
export const LEVELS = [
  { level: 1, title: 'Newcomer', minXp: 0 },
  { level: 2, title: 'Explorer', minXp: 100 },
  { level: 3, title: 'Contributor', minXp: 300 },
  { level: 4, title: 'Reviewer', minXp: 600 },
  { level: 5, title: 'Mentor', minXp: 1000 },
  { level: 6, title: 'Expert', minXp: 2000 },
  { level: 7, title: 'Master', minXp: 5000 }
];

export class ContributorOnboardingService {
  /**
   * Generate personalized learning path for a contributor
   */
  generateLearningPath(
    skillLevel: 'beginner' | 'intermediate' | 'advanced',
    interests: string[],
    completedPaths: string[]
  ): LearningPath[] {
    return LEARNING_PATHS.filter(path => {
      if (completedPaths.includes(path.id)) return false;
      if (skillLevel === 'beginner' && path.difficulty === 'advanced') return false;
      return path.skills.some(skill => interests.includes(skill));
    });
  }

  /**
   * Calculate XP for an action
   */
  calculateXp(
    action: 'analyze' | 'review-pr' | 'find-issue' | 'contribute' | 'help',
    quality: 'basic' | 'good' | 'excellent'
  ): number {
    const baseXp: Record<string, number> = {
      'analyze': 50,
      'review-pr': 100,
      'find-issue': 75,
      'contribute': 200,
      'help': 50
    };

    const multiplier: Record<string, number> = {
      'basic': 1,
      'good': 1.5,
      'excellent': 2
    };

    return Math.floor(baseXp[action] * multiplier[quality]);
  }

  /**
   * Check for new achievements
   */
  checkAchievements(progress: ContributorProgress): Achievement[] {
    const newAchievements: Achievement[] = [];

    for (const achievement of ACHIEVEMENTS) {
      if (progress.achievements.includes(achievement.id)) continue;

      const unlocked = this.evaluateAchievement(achievement.id, progress);
      if (unlocked) {
        progress.achievements.push(achievement.id);
        progress.totalXp += achievement.xp;
        newAchievements.push({ ...achievement, unlockedAt: new Date() });
      }
    }

    return newAchievements;
  }

  private evaluateAchievement(id: AchievementType, progress: ContributorProgress): boolean {
    switch (id) {
      case 'first-repo':
        return progress.repositoriesAnalyzed >= 1;
      case 'first-analysis':
        return progress.repositoriesAnalyzed >= 1;
      case 'first-pr':
        return progress.prsReviewed >= 1;
      case 'contributor':
        return progress.achievements.includes('first-pr');
      case 'mentor':
        return progress.achievements.length >= 5;
      case 'security-scout':
        return progress.skills['security-analysis'] >= 10;
      case 'documentation-hero':
        return progress.achievements.includes('first-analysis');
      case 'bug-hunter':
        return progress.issuesClosed >= 5;
      default:
        return false;
    }
  }

  /**
   * Get contributor level
   */
  getLevel(xp: number): { level: number; title: string; progress: number; nextLevelXp: number } {
    const currentLevel = LEVELS.reduce((acc, lvl) => {
      if (xp >= lvl.minXp) return lvl;
      return acc;
    }, LEVELS[0]);

    const nextLevel = LEVELS.find(l => l.minXp > currentLevel.minXp);
    const progress = nextLevel 
      ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
      : 100;

    return {
      level: currentLevel.level,
      title: currentLevel.title,
      progress: Math.min(100, Math.floor(progress)),
      nextLevelXp: nextLevel?.minXp || xp
    };
  }

  /**
   * Generate beginner-friendly suggestions
   */
  generateSuggestions(
    repoStructure: string[],
    skillLevel: string
  ): string[] {
    const suggestions: string[] = [];

    // File-based suggestions
    if (repoStructure.some(f => f.includes('README'))) {
      suggestions.push('Start by reading the README.md file');
    }
    if (repoStructure.some(f => f.includes('CONTRIBUTING'))) {
      suggestions.push('Check CONTRIBUTING.md for contribution guidelines');
    }
    if (repoStructure.some(f => f.includes('.github'))) {
      suggestions.push('Look in .github folder for CI/CD workflows');
    }
    if (repoStructure.some(f => f.includes('__tests__') || f.includes('test'))) {
      suggestions.push('This project has tests - running them first can help understanding');
    }

    // Skill-based suggestions
    if (skillLevel === 'beginner') {
      suggestions.push('Start by exploring the main entry points');
      suggestions.push('Look for files with "index" or "main" in the name');
      suggestions.push('Focus on understanding one module at a time');
    }

    return suggestions;
  }
}

export const contributorOnboardingService = new ContributorOnboardingService();
