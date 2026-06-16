/**
 * Recently Active Areas Types
 * Defines types for tracking and analyzing recent development activity
 */

export type ActivityMetric = "commits" | "contributors" | "fileChanges" | "frequency" | "recency";

export type AreaType = "module" | "folder" | "feature" | "service" | "component";

export type TimeWindow = "week" | "twoWeeks" | "month" | "quarter";

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: number;
  filesAdded: number;
  filesRemoved: number;
  filesModified: number;
  insertions: number;
  deletions: number;
  affectedPaths: string[];
}

export interface AreaActivity {
  id: string;
  path: string;
  name: string;
  type: AreaType;
  activityScore: number; // 0-100
  lastUpdated: Date;
  lastUpdatedFormatted: string;
  commitsInPeriod: number;
  uniqueContributors: number;
  totalFilesChanged: number;
  filesModified: number;
  filesAdded: number;
  filesRemoved: number;
  totalInsertions: number;
  totalDeletions: number;
  commitFrequency: number; // commits per week
  recencyScore: number; // 0-100, higher = more recent
  impactScore: number; // 0-100, based on changes
  contributorMomentum: number; // 0-100
  relatedAreas: string[];
  recentCommits: CommitInfo[];
  changeVelocity: "accelerating" | "stable" | "declining";
}

export interface RecentActivityAnalysis {
  repositoryId: string;
  analysisDate: Date;
  timeWindow: TimeWindow;
  windowDays: number;
  totalCommits: number;
  uniqueContributors: number;
  affectedAreas: number;
  topActiveAreas: AreaActivity[];
  activityTrends: ActivityTrend[];
  hotspots: HotspotArea[];
  recommendations: ActivityRecommendation[];
}

export interface ActivityTrend {
  period: string;
  totalCommits: number;
  activeAreas: number;
  averageActivityScore: number;
  topContributors: number;
  changedFiles: number;
}

export interface HotspotArea {
  path: string;
  name: string;
  activityLevel: "critical" | "high" | "moderate" | "low";
  commitCount: number;
  contributors: string[];
  lastCommitDate: Date;
  suggestionForContributors: string;
}

export interface ActivityRecommendation {
  title: string;
  description: string;
  targetArea: string;
  priority: "high" | "medium" | "low";
  action: string;
  estimatedImpact: string;
}

export interface AreaCommitSnapshot {
  area: string;
  timestamp: Date;
  commitCount: number;
  fileCount: number;
  contributors: number;
  activityScore: number;
}

export interface ContributorActivity {
  contributor: string;
  commitCount: number;
  filesChanged: number;
  areasContributedTo: string[];
  lastActivityDate: Date;
  activityStreak: number; // days
}

export interface ActivityMetrics {
  totalActivity: number;
  peakActivityTime: string;
  averageCommitsPerDay: number;
  averageFilesPerCommit: number;
  coreAreasCount: number;
  emergingAreasCount: number;
  dormantAreasCount: number;
  healthIndicator: "thriving" | "active" | "stable" | "declining";
}

export const AREA_TYPES: AreaType[] = ["module", "folder", "feature", "service", "component"];

export const TIME_WINDOWS: Record<TimeWindow, number> = {
  week: 7,
  twoWeeks: 14,
  month: 30,
  quarter: 90,
};

export const ACTIVITY_LEVEL_THRESHOLDS = {
  critical: 75,
  high: 50,
  moderate: 25,
  low: 0,
} as const;

export const CONTRIBUTOR_ACTIVITY_LEVELS = {
  veryActive: 20,
  active: 10,
  moderate: 5,
  inactive: 0,
} as const;

export interface RecentlyActiveAreasPanelConfig {
  timeWindow: TimeWindow;
  maxAreasToShow: number;
  enableTrendAnalysis: boolean;
  enableContributorTracking: boolean;
  minActivityScore: number;
  groupByType: boolean;
}
