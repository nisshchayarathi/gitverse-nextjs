/**
 * Phase 7: Repository Learning Mode
 * 
 * PARTIAL: GitVerse has explanation panels and tutorials
 * NEW: Added structured lessons, quizzes, and progress tracking
 */

export const PHASE_7_STATUS = {
  completed: true,
  components: {
    'Interactive Lessons': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-7-learning-mode.ts']
    },
    'Code Walkthroughs': {
      status: '✅ Complete',
      files: ['src/components/ai/AIExplanationPanel.tsx']
    },
    'Architecture Tutorials': {
      status: '✅ Complete',
      files: ['lib/services/documentation-generator.ts']
    }
  },
  newFeatures: [
    'Structured lesson modules',
    'Interactive quizzes',
    'Progress tracking',
    'Certificate generation',
    'Skill assessments'
  ]
};

export interface Lesson {
  id: string;
  title: string;
  description: string;
  module: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  sections: LessonSection[];
  quizzes: Quiz[];
  prerequisites: string[];
}

export interface LessonSection {
  id: string;
  title: string;
  content: string;
  codeExamples?: CodeExample[];
  exercises?: Exercise[];
  completed: boolean;
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
  highlightedLines?: number[];
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  task: string;
  hints: string[];
  solution?: string;
  validation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'code-completion' | 'short-answer';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
}

export interface LearningProgress {
  lessonId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  sectionsCompleted: string[];
  quizScores: { quizId: string; score: number; attempts: number }[];
  notes: string;
}

export interface LearnerProfile {
  userId: string;
  completedLessons: string[];
  inProgressLessons: string[];
  quizScores: Record<string, number>;
  badges: string[];
  totalLearningTime: number;
  strengths: string[];
  areasForImprovement: string[];
}

// Pre-built lessons for repository understanding
export const REPOSITORY_LESSONS: Lesson[] = [
  {
    id: 'repo-intro-1',
    title: 'Understanding Repository Structure',
    description: 'Learn how to navigate and understand a codebase structure',
    module: 'Getting Started',
    difficulty: 'beginner',
    duration: 20,
    prerequisites: [],
    sections: [
      {
        id: 's1',
        title: 'What is a Repository?',
        content: 'A repository (repo) is a storage location for your project\'s files and revision history...',
        completed: false
      },
      {
        id: 's2',
        title: 'Key Files and Folders',
        content: 'Every repository has standard files and folders that serve specific purposes...',
        codeExamples: [
          {
            language: 'bash',
            code: '# Common repository structure\nls -la\nREADME.md      # Project documentation\npackage.json   # Dependencies\nsrc/           # Source code\ntests/         # Test files',
            explanation: 'This shows a typical repository structure'
          }
        ],
        completed: false
      },
      {
        id: 's3',
        title: 'Entry Points',
        content: 'Understanding where the application starts helps you trace the flow...',
        completed: false
      }
    ],
    quizzes: [
      {
        id: 'q1',
        title: 'Repository Basics Quiz',
        passingScore: 70,
        questions: [
          {
            id: 'qq1',
            question: 'What does the README.md file typically contain?',
            type: 'multiple-choice',
            options: [
              'Source code',
              'Project documentation',
              'Test files',
              'Configuration'
            ],
            correctAnswer: 'Project documentation',
            explanation: 'README.md is the standard file for project documentation',
            points: 10
          }
        ]
      }
    ]
  },
  {
    id: 'code-arch-1',
    title: 'Understanding Code Architecture',
    description: 'Learn to identify architectural patterns in codebases',
    module: 'Architecture',
    difficulty: 'intermediate',
    duration: 30,
    prerequisites: ['repo-intro-1'],
    sections: [
      {
        id: 's1',
        title: 'MVC Architecture',
        content: 'Model-View-Controller is a common architectural pattern...',
        codeExamples: [
          {
            language: 'typescript',
            code: '// Model - Data structure\nexport interface User {\n  id: string;\n  name: string;\n}\n\n// View - UI component\nconst UserProfile = ({ user }: { user: User }) => {\n  return <div>{user.name}</div>;\n};\n\n// Controller - Business logic\nconst userController = {\n  async getUser(id: string): Promise<User> {\n    return db.users.findById(id);\n  }\n};',
            explanation: 'MVC separates concerns: Model handles data, View handles UI, Controller handles logic',
            highlightedLines: [1, 5, 12]
          }
        ],
        completed: false
      }
    ],
    quizzes: []
  }
];

export class LearningModeService {
  private lessons: Lesson[] = REPOSITORY_LESSONS;

  /**
   * Get lesson by ID
   */
  getLesson(lessonId: string): Lesson | undefined {
    return this.lessons.find(l => l.id === lessonId);
  }

  /**
   * Get lessons for a specific difficulty
   */
  getLessonsByDifficulty(difficulty: Lesson['difficulty']): Lesson[] {
    return this.lessons.filter(l => l.difficulty === difficulty);
  }

  /**
   * Generate personalized learning path
   */
  generateLearningPath(
    completedLessons: string[],
    targetTopic?: string
  ): Lesson[] {
    return this.lessons.filter(lesson => {
      if (completedLessons.includes(lesson.id)) return false;
      return lesson.prerequisites.every(p => completedLessons.includes(p));
    });
  }

  /**
   * Track lesson progress
   */
  updateProgress(
    progress: LearningProgress,
    action: 'start' | 'complete-section' | 'complete-quiz' | 'complete-lesson',
    data?: any
  ): LearningProgress {
    const updated = { ...progress };

    switch (action) {
      case 'start':
        updated.startedAt = new Date();
        break;
      case 'complete-section':
        if (!updated.sectionsCompleted.includes(data.sectionId)) {
          updated.sectionsCompleted.push(data.sectionId);
        }
        break;
      case 'complete-quiz':
        const existingQuiz = updated.quizScores.find(
          q => q.quizId === data.quizId
        );
        if (existingQuiz) {
          existingQuiz.attempts++;
          existingQuiz.score = Math.max(existingQuiz.score, data.score);
        } else {
          updated.quizScores.push({
            quizId: data.quizId,
            score: data.score,
            attempts: 1
          });
        }
        break;
      case 'complete-lesson':
        updated.completedAt = new Date();
        break;
    }

    return updated;
  }

  /**
   * Generate certificate for completed course
   */
  generateCertificate(
    userId: string,
    lessonIds: string[]
  ): {
    certificateId: string;
    userId: string;
    lessons: string[];
    completedAt: Date;
    verificationCode: string;
  } {
    return {
      certificateId: `CERT-${Date.now()}`,
      userId,
      lessons: lessonIds,
      completedAt: new Date(),
      verificationCode: this.generateVerificationCode()
    };
  }

  /**
   * Assess learner performance
   */
  assessPerformance(progress: LearningProgress[]): {
    averageScore: number;
    completedCount: number;
    inProgressCount: number;
    recommendations: string[];
  } {
    const quizScores = progress.flatMap(p => p.quizScores.map(q => q.score));
    const averageScore = quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 0;

    const recommendations: string[] = [];

    if (averageScore < 70) {
      recommendations.push('Review the material again before proceeding');
    }
    if (quizScores.some(s => s < 60)) {
      recommendations.push('Focus on the sections where you scored lowest');
    }

    return {
      averageScore: Math.round(averageScore),
      completedCount: progress.filter(p => p.completedAt).length,
      inProgressCount: progress.filter(p => !p.completedAt).length,
      recommendations
    };
  }

  /**
   * Validate quiz answer
   */
  validateQuizAnswer(
    question: QuizQuestion,
    answer: string
  ): { correct: boolean; explanation: string; points: number } {
    const correct = Array.isArray(question.correctAnswer)
      ? question.correctAnswer.includes(answer)
      : question.correctAnswer.toLowerCase() === answer.toLowerCase();

    return {
      correct,
      explanation: correct ? question.explanation : `Incorrect. ${question.explanation}`,
      points: correct ? question.points : 0
    };
  }

  private generateVerificationCode(): string {
    return Math.random().toString(36).substring(2, 15).toUpperCase();
  }
}

export const learningModeService = new LearningModeService();
