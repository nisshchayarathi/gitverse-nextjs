/**
 * Recently Active Areas Helper Utilities
 * Provides utility functions for activity analysis and formatting
 */

import {
  RecentActivityAnalysis,
  AreaActivity,
  TimeWindow,
} from "@/types/recentlyActiveAreas";
import { getActivityLevelDisplay } from "@/config/recentlyActiveAreasConfig";

/**
 * Formats activity score with interpretation
 */
export function formatActivityScore(score: number): {
  score: string;
  display: ReturnType<typeof getActivityLevelDisplay>;
} {
  return {
    score: `${Math.round(score)}/100`,
    display: getActivityLevelDisplay(score),
  };
}

/**
 * Generates summary of recent activity
 */
export function generateActivitySummary(analysis: RecentActivityAnalysis): string {
  const topArea = analysis.topActiveAreas[0];
  const secondArea = analysis.topActiveAreas[1];

  if (!topArea) {
    return "No recent activity detected in this repository.";
  }

  let summary = `In the last ${analysis.windowDays} days, `;
  summary += `${analysis.uniqueContributors} contributor${analysis.uniqueContributors !== 1 ? "s" : ""} `;
  summary += `made ${analysis.totalCommits} commit${analysis.totalCommits !== 1 ? "s" : ""} `;
  summary += `across ${analysis.affectedAreas} different area${analysis.affectedAreas !== 1 ? "s" : ""}. `;

  summary += `The most active area is ${topArea.name} with ${topArea.commitsInPeriod} commits.`;

  if (secondArea) {
    summary += ` Followed by ${secondArea.name} with ${secondArea.commitsInPeriod} commits.`;
  }

  return summary;
}

/**
 * Formats time window for display
 */
export function formatTimeWindow(window: TimeWindow): string {
  const labels: Record<TimeWindow, string> = {
    week: "Last Week",
    twoWeeks: "Last 2 Weeks",
    month: "Last Month",
    quarter: "Last Quarter",
  };
  return labels[window];
}

/**
 * Gets relative activity level
 */
export function getRelativeActivityLevel(
  currentActivity: number,
  averageActivity: number
): "above" | "at" | "below" {
  const tolerance = averageActivity * 0.2;

  if (currentActivity > averageActivity + tolerance) {
    return "above";
  }
  if (currentActivity < averageActivity - tolerance) {
    return "below";
  }
  return "at";
}

/**
 * Compares two time periods for activity trends
 */
export function compareActivityPeriods(
  current: RecentActivityAnalysis,
  previous: RecentActivityAnalysis | null
): {
  trend: "increasing" | "stable" | "decreasing";
  percentageChange: number;
  interpretation: string;
} {
  if (!previous) {
    return {
      trend: "stable",
      percentageChange: 0,
      interpretation: "No historical data available for comparison",
    };
  }

  const percentageChange = ((current.totalCommits - previous.totalCommits) / previous.totalCommits) * 100;
  let trend: "increasing" | "stable" | "decreasing";

  if (percentageChange > 20) {
    trend = "increasing";
  } else if (percentageChange < -20) {
    trend = "decreasing";
  } else {
    trend = "stable";
  }

  const interpretation =
    trend === "increasing"
      ? `Activity has increased by ${Math.round(percentageChange)}%`
      : trend === "decreasing"
      ? `Activity has decreased by ${Math.round(Math.abs(percentageChange))}%`
      : "Activity remains stable";

  return {
    trend,
    percentageChange,
    interpretation,
  };
}

/**
 * Identifies contributor patterns
 */
export function identifyContributorPatterns(areas: AreaActivity[]): {
  specialists: string;
  generalistas: string;
  emerging: string;
} {
  const specialistCount = areas.filter((a) => a.uniqueContributors === 1).length;
  const generalistaCount = areas.filter((a) => a.uniqueContributors > 5).length;
  const emergingCount = areas.filter((a) => a.uniqueContributors === 2).length;

  return {
    specialists: `${specialistCount} area${specialistCount !== 1 ? "s" : ""} with single-contributor focus`,
    generalistas: `${generalistaCount} area${generalistaCount !== 1 ? "s" : ""} with team collaboration`,
    emerging: `${emergingCount} area${emergingCount !== 1 ? "s" : ""} gaining contributors`,
  };
}

/**
 * Calculates effort distribution across areas
 */
export function calculateEffortDistribution(areas: AreaActivity[]): {
  area: string;
  percentage: number;
}[] {
  const totalCommits = areas.reduce((sum, a) => sum + a.commitsInPeriod, 0);

  return areas
    .map((area) => ({
      area: area.name,
      percentage: (area.commitsInPeriod / totalCommits) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);
}

/**
 * Generates insights from activity data
 */
export function generateActivityInsights(analysis: RecentActivityAnalysis): string[] {
  const insights: string[] = [];

  // Insight 1: Overall activity level
  if (analysis.totalCommits > 50) {
    insights.push("🔥 Repository has high development activity - great momentum!");
  } else if (analysis.totalCommits > 20) {
    insights.push("⚡ Steady development activity across the repository");
  } else if (analysis.totalCommits > 5) {
    insights.push("📝 Moderate activity - room for increased contributor involvement");
  } else {
    insights.push("⏳ Limited recent activity - consider reaching out to contributors");
  }

  // Insight 2: Focus areas
  const topArea = analysis.topActiveAreas[0];
  if (topArea && topArea.activityScore > 75) {
    insights.push(
      `🎯 ${topArea.name} is the focus area with ${topArea.commitsInPeriod} recent commits`
    );
  }

  // Insight 3: Team size
  if (analysis.uniqueContributors > 5) {
    insights.push(`👥 ${analysis.uniqueContributors} active contributors showing healthy team engagement`);
  } else if (analysis.uniqueContributors > 0) {
    insights.push(`👤 ${analysis.uniqueContributors} contributor${analysis.uniqueContributors !== 1 ? "s" : ""} maintaining the project`);
  }

  // Insight 4: Velocity
  const accelerating = analysis.topActiveAreas.filter(
    (a) => a.changeVelocity === "accelerating"
  ).length;
  if (accelerating > 2) {
    insights.push(`📈 Multiple areas gaining traction - project has momentum`);
  }

  // Insight 5: Maintenance needs
  const declining = analysis.topActiveAreas.filter(
    (a) => a.changeVelocity === "declining"
  ).length;
  if (declining > analysis.affectedAreas * 0.3) {
    insights.push(
      `⚠️ Several areas with declining activity - consider maintenance focus`
    );
  }

  return insights;
}

/**
 * Estimates contributor engagement level
 */
export function estimateEngagementLevel(
  analysis: RecentActivityAnalysis
): "high" | "medium" | "low" {
  const avgCommitsPerArea = analysis.totalCommits / Math.max(analysis.affectedAreas, 1);
  const avgContributorsPerArea = analysis.uniqueContributors / Math.max(analysis.affectedAreas, 1);

  const commitScore = avgCommitsPerArea > 10 ? 3 : avgCommitsPerArea > 5 ? 2 : 1;
  const contributorScore =
    avgContributorsPerArea > 2 ? 3 : avgContributorsPerArea > 1 ? 2 : 1;

  const totalScore = commitScore + contributorScore;

  if (totalScore >= 5) return "high";
  if (totalScore >= 3) return "medium";
  return "low";
}

/**
 * Suggests next actions based on activity
 */
export function suggestNextActions(analysis: RecentActivityAnalysis): string[] {
  const actions: string[] = [];

  const topArea = analysis.topActiveAreas[0];
  const mostNeedy = analysis.topActiveAreas.filter(
    (a) => a.changeVelocity === "declining"
  )[0];

  if (topArea) {
    actions.push(
      `✨ Explore recent changes in ${topArea.name} to understand current development direction`
    );
  }

  if (analysis.uniqueContributors === 1) {
    actions.push(
      `👥 Only 1 contributor detected - reach out to encourage team participation`
    );
  }

  if (mostNeedy) {
    actions.push(
      `🔧 ${mostNeedy.name} needs attention - review for technical debt or update needs`
    );
  }

  if (analysis.affectedAreas < 3) {
    actions.push(
      `📦 Development is focused on few areas - consider exploring other modules`
    );
  }

  const engagement = estimateEngagementLevel(analysis);
  if (engagement === "low") {
    actions.push(`📢 Community engagement is low - reach out or organize contribution drive`);
  }

  return actions.slice(0, 4);
}

/**
 * Formats date difference
 */
export function formatDateDiff(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

  if (diffDays === 0 && diffHours === 0) return "Just now";
  if (diffDays === 0) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}m ago`;
}

/**
 * Calculates percentage of total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Ranks areas by activity type
 */
export function rankAreasByActivityType(
  areas: AreaActivity[]
): Record<string, AreaActivity[]> {
  return {
    critical: areas.filter((a) => a.activityScore >= 75),
    high: areas.filter((a) => a.activityScore >= 50 && a.activityScore < 75),
    moderate: areas.filter((a) => a.activityScore >= 25 && a.activityScore < 50),
    low: areas.filter((a) => a.activityScore < 25),
  };
}

/**
 * Generates CSV export of activity
 */
export function exportActivityAsCSV(analysis: RecentActivityAnalysis): string {
  const headers = ["Area", "Commits", "Contributors", "Files Changed", "Activity Score", "Last Updated"];
  const rows = analysis.topActiveAreas.map((a) => [
    a.name,
    a.commitsInPeriod,
    a.uniqueContributors,
    a.totalFilesChanged,
    a.activityScore.toFixed(1),
    a.lastUpdatedFormatted,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return csv;
}
