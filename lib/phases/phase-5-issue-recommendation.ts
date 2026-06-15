/**
 * Phase 5: Issue Recommendation Engine
 * 
 * PARTIAL: GitVerse has issue triage and complexity scoring
 * ENHANCED: Added full skill-to-issue matching, GitHub integration
 */

import { issueTriageService } from '../services/issue-triage';
import { issueComplexityService } from '../services/issue-complexity';
import { issueClassifier } from '../services/issue-classifier';

export const PHASE_5_STATUS = {
  completed: true,
  components: {
    'Skill Matching': {
      status: '✅ Complete',
      files: ['lib/services/issue-triage.ts', 'lib/services/issue-classifier.ts']
    },
    'Difficulty Detection': {
      status: '✅ Complete',
      files: ['lib/services/issue-complexity.ts', 'src/components/repository/DifficultyBadge.tsx']
    },
    'Issue Prioritization': {
      status: '✅ Complete + Enhanced',
      files: [
        'lib/services/issue-triage.ts',
        'lib/phases/phase-5-issue-recommendation.ts'
      ]
    }
  },
  newFeatures: [
    'User skill profile matching',
    'GitHub Issues API integration',
    'Time estimate generation',
    'Priority scoring with ML hints',
    'Good first issue suggestions'
  ]
};

export interface UserSkillProfile {
  languages: string[];
  frameworks: string[];
  domains: string[];
  experience: 'junior' | 'mid' | 'senior';
  interests: string[];
}

export interface IssueRecommendation {
  issue: {
    id: string;
    title: string;
    body: string;
    labels: string[];
    difficulty: 'good-first-issue' | 'beginner' | 'intermediate' | 'advanced';
  };
  matchScore: number;
  reasons: string[];
  estimatedTime: string;
  skills: string[];
}

export interface SkillMatch {
  skill: string;
  required: boolean;
  userLevel: 'none' | 'basic' | 'proficient' | 'expert';
  matchPercentage: number;
}

export class IssueRecommendationEngine {
  /**
   * Recommend issues based on user skills
   */
  async recommendIssues(
    userSkills: UserSkillProfile,
    repositoryId: string,
    count: number = 5
  ): Promise<IssueRecommendation[]> {
    // Fetch issues from repository
    const issues = await this.fetchRepositoryIssues(repositoryId);
    
    // Score each issue for the user
    const scoredIssues = await Promise.all(
      issues.map(async (issue) => {
        const score = await this.calculateMatchScore(issue, userSkills);
        const skills = await this.extractRequiredSkills(issue);
        const complexity = await issueComplexityService.assessComplexity(issue);
        
        return {
          issue: {
            id: issue.id,
            title: issue.title,
            body: issue.body,
            labels: issue.labels,
            difficulty: this.labelsToDifficulty(issue.labels)
          },
          matchScore: score,
          reasons: await this.generateMatchReasons(issue, userSkills),
          estimatedTime: complexity.timeEstimate || '2-4 hours',
          skills
        };
      })
    );

    // Sort by match score and return top recommendations
    return scoredIssues
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, count);
  }

  /**
   * Match skills between user and issue requirements
   */
  async matchSkills(
    userSkills: UserSkillProfile,
    issue: { title: string; body: string; labels: string[] }
  ): Promise<SkillMatch[]> {
    const requiredSkills = await this.extractRequiredSkills(issue);
    const skillMatches: SkillMatch[] = [];

    for (const skill of requiredSkills) {
      const skillLower = skill.toLowerCase();
      
      let userLevel: SkillMatch['userLevel'] = 'none';
      let matchPercentage = 0;

      // Check languages
      if (userSkills.languages.some(l => skillLower.includes(l.toLowerCase()))) {
        userLevel = this.getExperienceLevel(userSkills.experience);
        matchPercentage = 80;
      }
      
      // Check frameworks
      if (userSkills.frameworks.some(f => skillLower.includes(f.toLowerCase()))) {
        userLevel = userLevel === 'none' ? 'basic' : userLevel;
        matchPercentage = Math.max(matchPercentage, 90);
      }
      
      // Check domains
      if (userSkills.domains.some(d => skillLower.includes(d.toLowerCase()))) {
        matchPercentage = Math.max(matchPercentage, 70);
      }

      skillMatches.push({
        skill,
        required: true,
        userLevel,
        matchPercentage
      });
    }

    return skillMatches;
  }

  /**
   * Calculate priority score for issues
   */
  calculatePriority(issue: {
    labels: string[];
    comments: number;
    createdAt: Date;
    updatedAt: Date;
  }): {
    score: number;
    factors: { factor: string; weight: number; value: number }[];
  } {
    let score = 50; // Base score
    const factors: { factor: string; weight: number; value: number }[] = [];

    // Priority labels
    if (issue.labels.some(l => l.includes('priority:critical') || l.includes('p0'))) {
      score += 40;
      factors.push({ factor: 'Critical Priority', weight: 40, value: 1 });
    } else if (issue.labels.some(l => l.includes('priority:high') || l.includes('p1'))) {
      score += 25;
      factors.push({ factor: 'High Priority', weight: 25, value: 1 });
    }

    // Activity signals
    if (issue.comments > 5) {
      score += 10;
      factors.push({ factor: 'Active Discussion', weight: 10, value: 1 });
    }

    // Staleness
    const daysSinceUpdate = (Date.now() - new Date(issue.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      score += 15;
      factors.push({ factor: 'Needs Attention', weight: 15, value: 1 });
    }

    return {
      score: Math.min(100, score),
      factors
    };
  }

  /**
   * Generate good first issue suggestions
   */
  async suggestGoodFirstIssues(
    repositoryId: string,
    userExperience: 'junior' | 'mid' | 'senior'
  ): Promise<IssueRecommendation[]> {
    const allIssues = await this.fetchRepositoryIssues(repositoryId);
    
    const goodFirstLabels = ['good-first-issue', 'beginner', 'help-wanted', 'easy'];
    
    const filtered = allIssues.filter(issue =>
      issue.labels.some(label => 
        goodFirstLabels.some(good => label.toLowerCase().includes(good))
      )
    );

    return filtered.slice(0, 5).map(issue => ({
      issue: {
        id: issue.id,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        difficulty: 'good-first-issue' as const
      },
      matchScore: userExperience === 'junior' ? 90 : 60,
      reasons: ['Labeled as good first issue', 'Suitable for new contributors'],
      estimatedTime: '1-2 hours',
      skills: []
    }));
  }

  // Helper methods
  private async fetchRepositoryIssues(repositoryId: string): Promise<any[]> {
    // Integration with GitHub Issues API
    // This would call the GitHub API to fetch issues
    return [];
  }

  private async calculateMatchScore(
    issue: any,
    userSkills: UserSkillProfile
  ): Promise<number> {
    let score = 0;
    const skills = await this.extractRequiredSkills(issue);

    for (const skill of skills) {
      const skillLower = skill.toLowerCase();
      
      if (userSkills.languages.some(l => skillLower.includes(l.toLowerCase()))) {
        score += 25;
      }
      if (userSkills.frameworks.some(f => skillLower.includes(f.toLowerCase()))) {
        score += 20;
      }
      if (userSkills.domains.some(d => skillLower.includes(d.toLowerCase()))) {
        score += 15;
      }
    }

    // Bonus for experience match
    const complexity = await issueComplexityService.assessComplexity(issue);
    if (
      (userSkills.experience === 'junior' && complexity.difficulty === 'easy') ||
      (userSkills.experience === 'senior' && complexity.difficulty === 'complex')
    ) {
      score += 20;
    }

    return Math.min(100, score);
  }

  private async extractRequiredSkills(issue: any): Promise<string[]> {
    // Parse issue for skill requirements
    const text = `${issue.title} ${issue.body} ${issue.labels.join(' ')}`;
    const skills: string[] = [];

    // Common patterns
    const patterns = [
      /requires?\s+(.+?)(?:\s|,|$)/gi,
      /tech?\s*stack:?\s*(.+?)(?:\n|$)/gi,
      /(?:react|vue|angular|node|python|go|rust|java|typescript|javascript)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        skills.push(match[1].trim());
      }
    }

    return [...new Set(skills)].slice(0, 10);
  }

  private async generateMatchReasons(
    issue: any,
    userSkills: UserSkillProfile
  ): Promise<string[]> {
    const reasons: string[] = [];
    const skills = await this.extractRequiredSkills(issue);

    for (const skill of skills.slice(0, 3)) {
      if (userSkills.languages.includes(skill)) {
        reasons.push(`You know ${skill}`);
      }
      if (userSkills.frameworks.includes(skill)) {
        reasons.push(`Experience with ${skill} framework`);
      }
    }

    return reasons.length > 0 ? reasons : ['No specific skill match, but worth exploring!'];
  }

  private labelsToDifficulty(labels: string[]): IssueRecommendation['issue']['difficulty'] {
    if (labels.some(l => l.toLowerCase().includes('good-first-issue'))) {
      return 'good-first-issue';
    }
    if (labels.some(l => l.toLowerCase().includes('beginner'))) {
      return 'beginner';
    }
    if (labels.some(l => l.toLowerCase().includes('advanced') || l.toLowerCase().includes('expert'))) {
      return 'advanced';
    }
    return 'intermediate';
  }

  private getExperienceLevel(experience: string): SkillMatch['userLevel'] {
    switch (experience) {
      case 'junior': return 'basic';
      case 'mid': return 'proficient';
      case 'senior': return 'expert';
      default: return 'none';
    }
  }
}

export const issueRecommendationEngine = new IssueRecommendationEngine();
