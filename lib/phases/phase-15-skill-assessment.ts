/**
 * Phase 15: Developer Skill Assessment
 * 
 * NOT STARTED: New phase - Evaluate contributor readiness
 */

export const PHASE_15_STATUS = {
  completed: true,
  components: {
    'Skill Testing': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-15-skill-assessment.ts']
    },
    'Knowledge Assessment': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-15-skill-assessment.ts']
    },
    'Progress Tracking': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-15-skill-assessment.ts']
    }
  }
};

export interface SkillTest {
  id: string;
  skill: string;
  type: 'multiple-choice' | 'coding' | 'practical';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  questions: TestQuestion[];
  timeLimit?: number;
}

export interface TestQuestion {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  codeSnippet?: string;
  points: number;
}

export interface SkillProfile {
  userId: string;
  skills: Record<string, SkillLevel>;
  assessments: AssessmentResult[];
  certificates: Certificate[];
  recommendations: string[];
}

export interface SkillLevel {
  score: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  lastAssessed: Date;
  evidence: string[];
}

export interface AssessmentResult {
  testId: string;
  date: Date;
  score: number;
  passed: boolean;
  timeSpent: number;
}

export interface Certificate {
  id: string;
  title: string;
  issuedAt: Date;
  issuer: string;
  verificationCode: string;
}

export class DeveloperSkillAssessment {
  /**
   * Create skill test from repository
   */
  createSkillTest(
    skill: string,
    repositoryContext: { files: string[]; techStack: string[] }
  ): SkillTest {
    const questions: TestQuestion[] = [];

    // Generate questions based on tech stack
    for (const tech of repositoryContext.techStack) {
      questions.push({
        id: `${skill}-q1-${Date.now()}`,
        question: `What is the primary purpose of ${tech} in this codebase?`,
        options: [
          `State management for ${tech}`,
          `API communication`,
          `UI component rendering`,
          `Data persistence`
        ],
        correctAnswer: this.getCorrectAnswer(tech),
        explanation: `${tech} is used for specific purposes in this codebase`,
        points: 10
      });
    }

    return {
      id: `test-${skill}-${Date.now()}`,
      skill,
      type: 'multiple-choice',
      difficulty: 'intermediate',
      questions,
      timeLimit: 30
    };
  }

  /**
   * Evaluate test submission
   */
  evaluateTest(
    test: SkillTest,
    answers: Map<string, string>
  ): { score: number; passed: boolean; results: QuestionResult[] } {
    let totalPoints = 0;
    let earnedPoints = 0;
    const results: QuestionResult[] = [];

    for (const question of test.questions) {
      totalPoints += question.points;
      const answer = answers.get(question.id);
      const isCorrect = this.checkAnswer(question, answer);

      if (isCorrect) {
        earnedPoints += question.points;
      }

      results.push({
        questionId: question.id,
        givenAnswer: answer || '',
        correctAnswer: Array.isArray(question.correctAnswer) 
          ? question.correctAnswer.join(', ') 
          : question.correctAnswer,
        isCorrect,
        points: isCorrect ? question.points : 0,
        explanation: question.explanation
      });
    }

    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passingScore = 70;

    return {
      score,
      passed: score >= passingScore,
      results
    };
  }

  /**
   * Generate skill profile
   */
  generateSkillProfile(
    userId: string,
    assessments: AssessmentResult[]
  ): SkillProfile {
    const skills: Record<string, SkillLevel> = {};
    const recommendations: string[] = [];

    // Aggregate assessments by skill
    for (const assessment of assessments) {
      const skill = this.extractSkillFromTest(assessment.testId);
      if (!skills[skill]) {
        skills[skill] = {
          score: 0,
          level: 'beginner',
          lastAssessed: new Date(),
          evidence: []
        };
      }

      skills[skill].score = Math.max(skills[skill].score, assessment.score);
      skills[skill].level = this.scoreToLevel(skills[skill].score);
      skills[skill].evidence.push(assessment.testId);
    }

    // Generate recommendations
    for (const [skill, level] of Object.entries(skills)) {
      if (level.score < 70) {
        recommendations.push(`Improve ${skill} skills - current level: ${level.level}`);
      }
    }

    return {
      userId,
      skills,
      assessments,
      certificates: this.generateCertificates(skills),
      recommendations
    };
  }

  /**
   * Generate certificate
   */
  generateCertificate(
    userId: string,
    skill: string,
    score: number
  ): Certificate {
    return {
      id: `cert-${Date.now()}`,
      title: `${skill} Proficiency Certificate`,
      issuedAt: new Date(),
      issuer: 'GitVerse Assessment Platform',
      verificationCode: this.generateVerificationCode()
    };
  }

  // Helper methods
  private getCorrectAnswer(tech: string): string {
    const answers: Record<string, string> = {
      'React': 'UI component rendering',
      'Next.js': 'Server-side rendering and routing',
      'TypeScript': 'Type safety and code quality',
      'Prisma': 'Database ORM and type safety',
      'Tailwind': 'Utility-first CSS styling'
    };
    return answers[tech] || 'Application feature';
  }

  private checkAnswer(question: TestQuestion, answer?: string): boolean {
    if (!answer) return false;
    
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.includes(answer);
    }
    return question.correctAnswer.toLowerCase() === answer.toLowerCase();
  }

  private scoreToLevel(score: number): SkillLevel['level'] {
    if (score >= 90) return 'expert';
    if (score >= 75) return 'advanced';
    if (score >= 50) return 'intermediate';
    return 'beginner';
  }

  private extractSkillFromTest(testId: string): string {
    return testId.replace('test-', '').split('-')[0];
  }

  private generateCertificates(skills: Record<string, SkillLevel>): Certificate[] {
    return Object.entries(skills)
      .filter(([_, level]) => level.score >= 70)
      .map(([skill, _]) => ({
        id: `cert-${Date.now()}`,
        title: `${skill} Proficiency Certificate`,
        issuedAt: new Date(),
        issuer: 'GitVerse Assessment Platform',
        verificationCode: this.generateVerificationCode()
      }));
  }

  private generateVerificationCode(): string {
    return Math.random().toString(36).substring(2, 15).toUpperCase();
  }
}

interface QuestionResult {
  questionId: string;
  givenAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  explanation: string;
}

export const developerSkillAssessment = new DeveloperSkillAssessment();
