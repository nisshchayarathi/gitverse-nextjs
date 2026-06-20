/**
 * Recently Active Areas Detection Engine
 * Analyzes repository commit history to identify active development areas
 */

import {
  AreaActivity,
  RecentActivityAnalysis,
  CommitInfo,
  TimeWindow,
  ActivityTrend,
  HotspotArea,
  ActivityRecommendation,
  ActivityMetrics,
  TIME_WINDOWS,
  ACTIVITY_LEVEL_THRESHOLDS,
} from "@/types/recentlyActiveAreas";
import { RepositoryAnalysisData } from "@/types/contributionPath";

/**
 * Analyzes repository for recently active areas
 */
export function analyzeRecentActivity(
  repository: RepositoryAnalysisData | undefined,
  repositoryId: string,
  timeWindow: TimeWindow = "month"
): RecentActivityAnalysis {
  const windowDays = TIME_WINDOWS[timeWindow];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Generate mock commit data
  const commits = generateMockCommitHistory(repository, windowStart, now);

  // Group commits by area
  const areaMap = new Map<string, CommitInfo[]>();
  const contributorMap = new Map<string, Set<string>>();

  commits.forEach((commit) => {
    commit.affectedPaths.forEach((path) => {
      const area = extractAreaFromPath(path);
      if (!areaMap.has(area)) {
        areaMap.set(area, []);
      }
      areaMap.get(area)!.push(commit);

      // Track contributors
      if (!contributorMap.has(area)) {
        contributorMap.set(area, new Set());
      }
      contributorMap.get(area)!.add(commit.author);
    });
  });

  // Calculate activity for each area
  const activeAreas: AreaActivity[] = [];
  areaMap.forEach((areaCommits, path) => {
    const activity = calculateAreaActivity(
      path,
      areaCommits,
      contributorMap.get(path) || new Set()
    );
    if (activity.activityScore > 0) {
      activeAreas.push(activity);
    }
  });

  // Sort by activity score
  activeAreas.sort((a, b) => b.activityScore - a.activityScore);

  // Identify hotspots
  const hotspots = identifyHotspots(activeAreas);

  // Generate recommendations
  const recommendations = generateActivityRecommendations(activeAreas);

  // Calculate trends
  const trends = calculateActivityTrends(commits, windowDays);

  return {
    repositoryId,
    analysisDate: now,
    timeWindow,
    windowDays,
    totalCommits: commits.length,
    uniqueContributors: new Set(commits.map((c) => c.author)).size,
    affectedAreas: areaMap.size,
    topActiveAreas: activeAreas.slice(0, 10),
    activityTrends: trends,
    hotspots,
    recommendations,
  };
}

/**
 * Calculates activity metrics for a specific area
 */
function calculateAreaActivity(
  path: string,
  commits: CommitInfo[],
  contributors: Set<string>
): AreaActivity {
  if (commits.length === 0) {
    return createEmptyAreaActivity(path);
  }

  const lastCommit = commits[commits.length - 1];
  const firstCommit = commits[0];
  const daysSpan = Math.max(
    1,
    (lastCommit.date.getTime() - firstCommit.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  const filesChanged = commits.reduce((sum, c) => sum + c.filesChanged, 0);
  const filesAdded = commits.reduce((sum, c) => sum + c.filesAdded, 0);
  const filesRemoved = commits.reduce((sum, c) => sum + c.filesRemoved, 0);
  const filesModified = commits.reduce((sum, c) => sum + c.filesModified, 0);
  const insertions = commits.reduce((sum, c) => sum + c.insertions, 0);
  const deletions = commits.reduce((sum, c) => sum + c.deletions, 0);

  const recencyScore = calculateRecencyScore(lastCommit.date);
  const impactScore = calculateImpactScore(filesChanged, insertions, deletions);
  const contributorMomentum = (contributors.size / Math.max(daysSpan, 1)) * 50;
  const commitFrequency = (commits.length / daysSpan) * 7;

  const activityScore = calculateOverallActivityScore(
    commits.length,
    recencyScore,
    impactScore,
    contributorMomentum
  );

  const changeVelocity = detectChangeVelocity(commits);

  return {
    id: `area-${path.replace(/\//g, "-")}`,
    path,
    name: extractAreaName(path),
    type: inferAreaType(path),
    activityScore,
    lastUpdated: lastCommit.date,
    lastUpdatedFormatted: formatDate(lastCommit.date),
    commitsInPeriod: commits.length,
    uniqueContributors: contributors.size,
    totalFilesChanged: filesChanged,
    filesModified,
    filesAdded,
    filesRemoved,
    totalInsertions: insertions,
    totalDeletions: deletions,
    commitFrequency,
    recencyScore,
    impactScore,
    contributorMomentum,
    relatedAreas: identifyRelatedAreas(commits),
    recentCommits: commits.slice(-3).reverse(),
    changeVelocity,
  };
}

/**
 * Calculates recency score (0-100)
 */
function calculateRecencyScore(lastCommitDate: Date): number {
  const now = new Date();
  const daysSinceLastCommit = (now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastCommit <= 1) return 100;
  if (daysSinceLastCommit <= 3) return 90;
  if (daysSinceLastCommit <= 7) return 75;
  if (daysSinceLastCommit <= 14) return 50;
  if (daysSinceLastCommit <= 30) return 25;
  return 10;
}

/**
 * Calculates impact score (0-100)
 */
function calculateImpactScore(filesChanged: number, insertions: number, deletions: number): number {
  const avgChangesPerFile = filesChanged > 0 ? (insertions + deletions) / filesChanged : 0;
  const fileImpact = Math.min(100, filesChanged * 5);
  const changeImpact = Math.min(100, avgChangesPerFile / 10);

  return (fileImpact * 0.6 + changeImpact * 0.4);
}

/**
 * Calculates overall activity score
 */
function calculateOverallActivityScore(
  commitCount: number,
  recencyScore: number,
  impactScore: number,
  contributorMomentum: number
): number {
  const commitScore = Math.min(100, commitCount * 5);
  return Math.min(
    100,
    commitScore * 0.3 + recencyScore * 0.4 + impactScore * 0.2 + contributorMomentum * 0.1
  );
}

/**
 * Detects change velocity trend
 */
function detectChangeVelocity(commits: CommitInfo[]): "accelerating" | "stable" | "declining" {
  if (commits.length < 3) return "stable";

  const recent = commits.slice(-3).length;
  const older = commits.slice(-6, -3).length || 1;

  if (recent / older > 1.5) return "accelerating";
  if (recent / older < 0.7) return "declining";
  return "stable";
}

/**
 * Identifies related areas from commit messages and paths
 */
function identifyRelatedAreas(commits: CommitInfo[]): string[] {
  const relatedSet = new Set<string>();

  commits.slice(-5).forEach((commit) => {
    const paths = commit.affectedPaths
      .map((p) => extractAreaFromPath(p))
      .filter((area) => area.length > 0);
    paths.forEach((p) => relatedSet.add(p));
  });

  return Array.from(relatedSet).slice(0, 3);
}

/**
 * Extracts area from file path
 */
function extractAreaFromPath(filePath: string): string {
  const parts = filePath.split("/");
  
  // Look for common directory patterns
  if (parts[0] === "src") {
    if (parts[1]) return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "app") {
    if (parts[1]) return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] || "root";
}

/**
 * Extracts display name from path
 */
function extractAreaName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Infers area type from path
 */
function inferAreaType(
  path: string
): "module" | "folder" | "feature" | "service" | "component" {
  if (path.includes("/components/")) return "component";
  if (path.includes("/services/")) return "service";
  if (path.includes("/features/")) return "feature";
  if (path.includes("/modules/")) return "module";
  return "folder";
}

/**
 * Identifies hotspot areas
 */
function identifyHotspots(areas: AreaActivity[]): HotspotArea[] {
  return areas.slice(0, 5).map((area) => {
    let activityLevel: "critical" | "high" | "moderate" | "low";
    if (area.activityScore >= ACTIVITY_LEVEL_THRESHOLDS.critical) {
      activityLevel = "critical";
    } else if (area.activityScore >= ACTIVITY_LEVEL_THRESHOLDS.high) {
      activityLevel = "high";
    } else if (area.activityScore >= ACTIVITY_LEVEL_THRESHOLDS.moderate) {
      activityLevel = "moderate";
    } else {
      activityLevel = "low";
    }

    const suggestion =
      activityLevel === "critical"
        ? "High activity detected. Great place to contribute or review recent changes."
        : activityLevel === "high"
        ? "Moderate activity. Good area for contributions and learning."
        : "Lower activity. Ideal for maintenance and documentation improvements.";

    return {
      path: area.path,
      name: area.name,
      activityLevel,
      commitCount: area.commitsInPeriod,
      contributors: [],
      lastCommitDate: area.lastUpdated,
      suggestionForContributors: suggestion,
    };
  });
}

/**
 * Generates activity recommendations
 */
function generateActivityRecommendations(
  areas: AreaActivity[]
): ActivityRecommendation[] {
  const recommendations: ActivityRecommendation[] = [];

  if (areas.length > 0) {
    const topArea = areas[0];
    recommendations.push({
      title: "Focus on High-Activity Area",
      description: `The ${topArea.name} area is receiving significant attention with ${topArea.commitsInPeriod} recent commits.`,
      targetArea: topArea.path,
      priority: "high",
      action:
        "Review recent changes, contribute enhancements, or help review pending PRs in this area.",
      estimatedImpact: "Direct contribution to active development",
    });
  }

  const emergingArea = areas.filter((a) => a.changeVelocity === "accelerating")[0];
  if (emergingArea) {
    recommendations.push({
      title: "Participate in Emerging Focus",
      description: `Activity in ${emergingArea.name} is accelerating (${emergingArea.changeVelocity}).`,
      targetArea: emergingArea.path,
      priority: "high",
      action:
        "This area will likely need more contributions soon. Good time to get involved.",
      estimatedImpact: "Build expertise in growing area",
    });
  }

  const dormantArea = areas
    .filter((a) => a.changeVelocity === "declining")
    .slice(0, 1)[0];
  if (dormantArea) {
    recommendations.push({
      title: "Maintain Stable Areas",
      description: `${dormantArea.name} has declining activity but may need maintenance updates.`,
      targetArea: dormantArea.path,
      priority: "medium",
      action:
        "Review for technical debt, update dependencies, improve documentation.",
      estimatedImpact: "Improve code quality and maintainability",
    });
  }

  return recommendations.slice(0, 5);
}

/**
 * Calculates activity trends over time
 */
function calculateActivityTrends(commits: CommitInfo[], windowDays: number): ActivityTrend[] {
  const trends: ActivityTrend[] = [];
  const periodsCount = Math.ceil(windowDays / 7);

  for (let i = 0; i < periodsCount; i++) {
    const periodStart = new Date(commits[0].date.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const periodCommits = commits.filter((c) => c.date >= periodStart && c.date < periodEnd);
    const activeAreas = new Set(
      periodCommits.flatMap((c) => c.affectedPaths.map((p) => extractAreaFromPath(p)))
    );

    trends.push({
      period: `Week ${i + 1}`,
      totalCommits: periodCommits.length,
      activeAreas: activeAreas.size,
      averageActivityScore:
        periodCommits.length > 0
          ? periodCommits.reduce((sum, c) => sum + (c.filesChanged * 5), 0) /
            periodCommits.length
          : 0,
      topContributors: new Set(periodCommits.map((c) => c.author)).size,
      changedFiles: periodCommits.reduce((sum, c) => sum + c.filesChanged, 0),
    });
  }

  return trends;
}

/**
 * Creates empty area activity
 */
function createEmptyAreaActivity(path: string): AreaActivity {
  return {
    id: `area-${path.replace(/\//g, "-")}`,
    path,
    name: extractAreaName(path),
    type: inferAreaType(path),
    activityScore: 0,
    lastUpdated: new Date(),
    lastUpdatedFormatted: "Never",
    commitsInPeriod: 0,
    uniqueContributors: 0,
    totalFilesChanged: 0,
    filesModified: 0,
    filesAdded: 0,
    filesRemoved: 0,
    totalInsertions: 0,
    totalDeletions: 0,
    commitFrequency: 0,
    recencyScore: 0,
    impactScore: 0,
    contributorMomentum: 0,
    relatedAreas: [],
    recentCommits: [],
    changeVelocity: "stable",
  };
}

/**
 * Generates mock commit history for testing
 */
function generateMockCommitHistory(
  _repository: RepositoryAnalysisData | undefined,
  startDate: Date,
  endDate: Date
): CommitInfo[] {
  const commits: CommitInfo[] = [];
  const filePatterns = [
    "src/components",
    "src/services",
    "src/utils",
    "src/types",
    "app/api",
    "lib/auth",
    "prisma",
  ];

  const authors = ["Alice Dev", "Bob Coder", "Carol Engineer", "Dave Manager", "Eve Designer"];

  let currentDate = new Date(startDate);

  while (currentDate < endDate) {
    if (Math.random() > 0.3) {
      const commitCount = Math.floor(Math.random() * 5) + 1;

      for (let i = 0; i < commitCount; i++) {
        const filesCount = Math.floor(Math.random() * 8) + 1;
        const affectedPaths = [];

        for (let j = 0; j < filesCount; j++) {
          const pattern = filePatterns[Math.floor(Math.random() * filePatterns.length)];
          affectedPaths.push(`${pattern}/file${j}.ts`);
        }

        commits.push({
          hash: `commit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `Update: ${affectedPaths[0]}`,
          author: authors[Math.floor(Math.random() * authors.length)],
          date: new Date(currentDate),
          filesChanged: filesCount,
          filesAdded: Math.floor(filesCount * 0.3),
          filesRemoved: Math.floor(filesCount * 0.2),
          filesModified: Math.floor(filesCount * 0.5),
          insertions: Math.floor(Math.random() * 500) + 10,
          deletions: Math.floor(Math.random() * 200) + 5,
          affectedPaths,
        });
      }
    }

    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return commits;
}

/**
 * Formats date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return date.toLocaleDateString();
}

/**
 * Calculates activity metrics
 */
export function calculateActivityMetrics(analysis: RecentActivityAnalysis): ActivityMetrics {
  const topAreas = analysis.topActiveAreas;
  const criticalCount = topAreas.filter(
    (a) => a.activityScore >= ACTIVITY_LEVEL_THRESHOLDS.critical
  ).length;
  const emergingCount = topAreas.filter((a) => a.changeVelocity === "accelerating").length;
  const decliningCount = topAreas.filter((a) => a.changeVelocity === "declining").length;

  let healthIndicator: "thriving" | "active" | "stable" | "declining";
  if (criticalCount > 3) {
    healthIndicator = "thriving";
  } else if (analysis.totalCommits > 20) {
    healthIndicator = "active";
  } else if (analysis.totalCommits > 5) {
    healthIndicator = "stable";
  } else {
    healthIndicator = "declining";
  }

  return {
    totalActivity: analysis.totalCommits,
    peakActivityTime: analysis.activityTrends[0]?.period || "N/A",
    averageCommitsPerDay: analysis.totalCommits / analysis.windowDays,
    averageFilesPerCommit: topAreas.reduce((sum, a) => sum + a.totalFilesChanged, 0) / Math.max(analysis.totalCommits, 1),
    coreAreasCount: criticalCount,
    emergingAreasCount: emergingCount,
    dormantAreasCount: decliningCount,
    healthIndicator,
  };
}
