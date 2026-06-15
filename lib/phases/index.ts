/**
 * GitVerse Evolution Roadmap - All Phases Index
 * 
 * This file exports all 25 phases of the GitVerse Evolution Roadmap,
 * transforming GitVerse from a repository visualization tool into
 * a complete AI-powered Repository Operating System (RepoOS).
 */

// Phase exports
export * from './phase-1-project-foundation';
export * from './phase-2-architecture-explorer';
export * from './phase-3-understanding-engine';
export * from './phase-4-contributor-onboarding';
export * from './phase-5-issue-recommendation';
export * from './phase-6-ai-mentor';
export * from './phase-7-learning-mode';
export * from './phase-8-bug-detection';
export * from './phase-9-health-dashboard';
export * from './phase-10-ai-pr-reviewer';
export * from './phase-11-security-engine';
export * from './phase-12-documentation-generator';
export * from './phase-13-timeline-intelligence';
export * from './phase-14-interview-prep';
export * from './phase-15-skill-assessment';
export * from './phase-16-knowledge-graph';
export * from './phase-17-multi-repo-analysis';
export * from './phase-18-memory-layer';
export * from './phase-19-architecture-consultant';
export * from './phase-20-refactoring-agent';
export * from './phase-21-testing-agent';
export * from './phase-22-documentation-agent';
export * from './phase-23-security-agent';
export * from './phase-24-multi-agent';
export * from './phase-25-repo-os';

import { PHASE_1_STATUS } from './phase-1-project-foundation';
import { PHASE_2_STATUS } from './phase-2-architecture-explorer';
import { PHASE_3_STATUS } from './phase-3-understanding-engine';
import { PHASE_4_STATUS } from './phase-4-contributor-onboarding';
import { PHASE_5_STATUS } from './phase-5-issue-recommendation';
import { PHASE_6_STATUS } from './phase-6-ai-mentor';
import { PHASE_7_STATUS } from './phase-7-learning-mode';
import { PHASE_8_STATUS } from './phase-8-bug-detection';
import { PHASE_9_STATUS } from './phase-9-health-dashboard';
import { PHASE_10_STATUS } from './phase-10-ai-pr-reviewer';
import { PHASE_11_STATUS } from './phase-11-security-engine';
import { PHASE_12_STATUS } from './phase-12-documentation-generator';
import { PHASE_13_STATUS } from './phase-13-timeline-intelligence';
import { PHASE_14_STATUS } from './phase-14-interview-prep';
import { PHASE_15_STATUS } from './phase-15-skill-assessment';
import { PHASE_16_STATUS } from './phase-16-knowledge-graph';
import { PHASE_17_STATUS } from './phase-17-multi-repo-analysis';
import { PHASE_18_STATUS } from './phase-18-memory-layer';
import { PHASE_19_STATUS } from './phase-19-architecture-consultant';
import { PHASE_20_STATUS } from './phase-20-refactoring-agent';
import { PHASE_21_STATUS } from './phase-21-testing-agent';
import { PHASE_22_STATUS } from './phase-22-documentation-agent';
import { PHASE_23_STATUS } from './phase-23-security-agent';
import { PHASE_24_STATUS } from './phase-24-multi-agent';
import { PHASE_25_STATUS } from './phase-25-repo-os';

/**
 * Complete roadmap status summary
 */
export const ROADMAP_STATUS = {
  totalPhases: 25,
  completed: 25,
  inProgress: 0,
  planned: 0,
  phases: [
    { ...PHASE_1_STATUS, phase: 1, title: 'Project Foundation' },
    { ...PHASE_2_STATUS, phase: 2, title: 'Repository Architecture Explorer' },
    { ...PHASE_3_STATUS, phase: 3, title: 'Repository Understanding Engine' },
    { ...PHASE_4_STATUS, phase: 4, title: 'Contributor Onboarding Assistant' },
    { ...PHASE_5_STATUS, phase: 5, title: 'Issue Recommendation Engine' },
    { ...PHASE_6_STATUS, phase: 6, title: 'AI Contributor Mentor' },
    { ...PHASE_7_STATUS, phase: 7, title: 'Repository Learning Mode' },
    { ...PHASE_8_STATUS, phase: 8, title: 'Bug Detection Intelligence' },
    { ...PHASE_9_STATUS, phase: 9, title: 'Repository Health Dashboard' },
    { ...PHASE_10_STATUS, phase: 10, title: 'AI PR Reviewer' },
    { ...PHASE_11_STATUS, phase: 11, title: 'Security Analysis Engine' },
    { ...PHASE_12_STATUS, phase: 12, title: 'Documentation Generator' },
    { ...PHASE_13_STATUS, phase: 13, title: 'Repository Timeline Intelligence' },
    { ...PHASE_14_STATUS, phase: 14, title: 'Interview Preparation Engine' },
    { ...PHASE_15_STATUS, phase: 15, title: 'Developer Skill Assessment' },
    { ...PHASE_16_STATUS, phase: 16, title: 'Knowledge Graph System' },
    { ...PHASE_17_STATUS, phase: 17, title: 'Multi-Repository Analysis' },
    { ...PHASE_18_STATUS, phase: 18, title: 'Repository Memory Layer' },
    { ...PHASE_19_STATUS, phase: 19, title: 'AI Architecture Consultant' },
    { ...PHASE_20_STATUS, phase: 20, title: 'AI Refactoring Agent' },
    { ...PHASE_21_STATUS, phase: 21, title: 'AI Testing Agent' },
    { ...PHASE_22_STATUS, phase: 22, title: 'AI Documentation Agent' },
    { ...PHASE_23_STATUS, phase: 23, title: 'AI Security Agent' },
    { ...PHASE_24_STATUS, phase: 24, title: 'Multi-Agent Collaboration System' },
    { ...PHASE_25_STATUS, phase: 25, title: 'GitVerse RepoOS' }
  ]
};
