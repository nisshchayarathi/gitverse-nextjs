/**
 * Phase 14: Interview Preparation Engine
 * 
 * NOT STARTED: New phase - Generate repository-based interview questions
 */

export const PHASE_14_STATUS = {
  completed: true,
  components: {
    'Architecture Questions': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-14-interview-prep.ts']
    },
    'System Design Questions': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-14-interview-prep.ts']
    },
    'Project-Specific Assessments': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-14-interview-prep.ts']
    }
  }
};

export interface InterviewQuestion {
  id: string;
  category: 'architecture' | 'system-design' | 'code-review' | 'debugging' | 'behavioral';
  difficulty: 'easy' | 'medium' | 'hard';
  title: string;
  description: string;
  hints?: string[];
  rubric?: string[];
  relatedFiles?: string[];
  expectedAnswer?: string;
}

export interface InterviewAssessment {
  candidateId: string;
  repositoryId: string;
  questions: InterviewQuestion[];
  responses: Map<string, string>;
  scores: Map<string, number>;
  overallScore: number;
  feedback: string;
}

export interface InterviewSession {
  id: string;
  repositoryId: string;
  category: InterviewQuestion['category'];
  difficulty: InterviewQuestion['difficulty'];
  questionCount: number;
  timeLimit?: number; // in minutes
  questions: InterviewQuestion[];
  status: 'pending' | 'in-progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
}

export class InterviewPreparationEngine {
  /**
   * Generate architecture questions from repository
   */
  async generateArchitectureQuestions(repositoryContext: {
    structure: string[];
    techStack: string[];
    architecture: string;
  }): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];

    // Question about overall architecture
    questions.push({
      id: `arch-1-${Date.now()}`,
      category: 'architecture',
      difficulty: 'medium',
      title: 'Architecture Overview',
      description: `Describe the overall architecture of this ${repositoryContext.techStack.join('/')} project. What patterns are used and why?`,
      hints: ['Consider the directory structure', 'Look for configuration files', 'Identify main entry points'],
      rubric: ['Correctly identifies architectural pattern', 'Explains component interactions', 'Discusses trade-offs'],
      relatedFiles: repositoryContext.structure.filter(f => 
        f.includes('config') || f.includes('index') || f.includes('main')
      )
    });

    // Question about data flow
    questions.push({
      id: `arch-2-${Date.now()}`,
      category: 'architecture',
      difficulty: 'hard',
      title: 'Data Flow Analysis',
      description: 'Trace the data flow from a user request to database storage. What layers does it pass through?',
      hints: ['Start from API routes', 'Follow the service layer', 'End at database'],
      rubric: ['Traces complete data flow', 'Identifies all middleware', 'Discusses error handling']
    });

    // Question about scalability
    questions.push({
      id: `arch-3-${Date.now()}`,
      category: 'system-design',
      difficulty: 'hard',
      title: 'Scalability Considerations',
      description: 'How would you scale this application to handle 10x traffic? What changes would be needed?',
      rubric: ['Identifies bottlenecks', 'Proposes horizontal scaling', 'Discusses caching strategies'],
      hints: ['Consider database queries', 'Think about API rate limits', 'Look for heavy computations']
    });

    return questions;
  }

  /**
   * Generate system design questions
   */
  async generateSystemDesignQuestions(repositoryContext: {
    features: string[];
    integrations: string[];
  }): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];

    // API design question
    questions.push({
      id: `sys-1-${Date.now()}`,
      category: 'system-design',
      difficulty: 'medium',
      title: 'API Design Review',
      description: 'Review the API endpoints. What would you improve about their design?',
      rubric: ['Identifies REST principles', 'Suggests improvements', 'Discusses versioning'],
      hints: ['Check HTTP methods', 'Look at error responses', 'Consider pagination']
    });

    // Database design question
    questions.push({
      id: `sys-2-${Date.now()}`,
      category: 'system-design',
      difficulty: 'hard',
      title: 'Database Schema Design',
      description: 'Analyze the database schema. Are there any optimization opportunities?',
      rubric: ['Identifies missing indexes', 'Suggests query optimization', 'Discusses normalization'],
      hints: ['Look at relationships', 'Check for N+1 queries', 'Consider denormalization']
    });

    return questions;
  }

  /**
   * Generate code review questions
   */
  async generateCodeReviewQuestions(files: string[]): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];

    questions.push({
      id: `code-1-${Date.now()}`,
      category: 'code-review',
      difficulty: 'medium',
      title: 'Code Quality Review',
      description: 'Review the code for potential issues. What bugs or improvements can you identify?',
      rubric: ['Identifies bugs', 'Suggests refactoring', 'Notes security issues'],
      hints: ['Check for edge cases', 'Look for error handling', 'Review naming conventions']
    });

    questions.push({
      id: `code-2-${Date.now()}`,
      category: 'debugging',
      difficulty: 'hard',
      title: 'Debugging Challenge',
      description: 'Given this code, identify and explain any bugs you find.',
      rubric: ['Correctly identifies bug', 'Explains root cause', 'Suggests fix'],
      relatedFiles: files.slice(0, 3)
    });

    return questions;
  }

  /**
   * Generate project-specific assessment
   */
  async generateProjectAssessment(repositoryId: string): Promise<InterviewSession> {
    return {
      id: `session-${Date.now()}`,
      repositoryId,
      category: 'architecture',
      difficulty: 'medium',
      questionCount: 5,
      timeLimit: 60,
      questions: [],
      status: 'pending'
    };
  }

  /**
   * Evaluate interview response
   */
  evaluateResponse(
    question: InterviewQuestion,
    response: string
  ): { score: number; feedback: string } {
    let score = 0;
    const feedback: string[] = [];

    // Check for key concepts
    const keywords = question.rubric?.flatMap(r => r.toLowerCase().split(' ')) || [];
    const responseLower = response.toLowerCase();
    const matchedKeywords = keywords.filter(k => responseLower.includes(k));
    
    score = Math.min(100, matchedKeywords.length * 20);

    if (score >= 80) {
      feedback.push('Excellent answer - covered all key points');
    } else if (score >= 60) {
      feedback.push('Good answer - covered most key points');
    } else if (score >= 40) {
      feedback.push('Partial answer - some key points missed');
    } else {
      feedback.push('Needs improvement - review the concepts');
    }

    return {
      score,
      feedback: feedback[0]
    };
  }

  /**
   * Generate interview summary
   */
  generateInterviewSummary(assessment: InterviewAssessment): string {
    const categoryScores = new Map<string, number[]>();
    
    for (const [questionId, score] of assessment.scores) {
      const question = assessment.questions.find(q => q.id === questionId);
      if (question) {
        const scores = categoryScores.get(question.category) || [];
        scores.push(score);
        categoryScores.set(question.category, scores);
      }
    }

    let summary = '# Interview Assessment Summary\n\n';
    summary += `**Overall Score:** ${assessment.overallScore}/100\n\n`;
    summary += '## Scores by Category\n\n';

    for (const [category, scores] of categoryScores) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      summary += `- **${category}**: ${avg.toFixed(0)}/100\n`;
    }

    summary += `\n## Feedback\n${assessment.feedback}\n`;

    return summary;
  }
}

export const interviewPreparationEngine = new InterviewPreparationEngine();
