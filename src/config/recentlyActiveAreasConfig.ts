/**
 * Recently Active Areas Configuration
 * Defines thresholds and parameters for activity analysis
 */

import { TimeWindow, RecentlyActiveAreasPanelConfig } from "@/types/recentlyActiveAreas";

export const DEFAULT_ACTIVITY_CONFIG: RecentlyActiveAreasPanelConfig = {
  timeWindow: "month",
  maxAreasToShow: 10,
  enableTrendAnalysis: true,
  enableContributorTracking: true,
  minActivityScore: 10,
  groupByType: false,
};

export const ACTIVITY_LEVEL_LABELS = {
  critical: "Critical Activity",
  high: "High Activity",
  moderate: "Moderate Activity",
  low: "Low Activity",
} as const;

export const VELOCITY_DESCRIPTIONS = {
  accelerating: "Increasing focus - momentum building",
  stable: "Consistent development - steady progress",
  declining: "Decreasing attention - reduced focus",
} as const;

export const HEALTH_INDICATORS = {
  thriving:
    "Repository has multiple active development areas with strong momentum",
  active: "Repository shows healthy development across several areas",
  stable: "Repository has steady development with moderate activity",
  declining:
    "Repository activity is declining - may need team focus or prioritization",
} as const;

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  week: "Last 7 Days",
  twoWeeks: "Last 14 Days",
  month: "Last 30 Days",
  quarter: "Last 90 Days",
};

export const ACTIVITY_SCORE_COLORS = {
  critical: "#dc2626",
  high: "#ea580c",
  moderate: "#f59e0b",
  low: "#10b981",
} as const;

export const CHANGE_VELOCITY_COLORS = {
  accelerating: "#3b82f6",
  stable: "#10b981",
  declining: "#f59e0b",
} as const;

export const RECOMMENDATION_PRIORITY_COLORS = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#3b82f6",
} as const;

export const AREA_TYPE_ICONS: Record<string, string> = {
  component: "⚛️",
  service: "⚙️",
  feature: "✨",
  module: "📦",
  folder: "📁",
};

export const ACTIVITY_METRICS_DESCRIPTIONS: Record<string, string> = {
  activityScore: "Overall activity in this area (0-100)",
  commitsInPeriod: "Number of commits made to this area",
  uniqueContributors: "Number of different contributors",
  totalFilesChanged: "Total files modified in this area",
  fileChangeRatio: "Percentage of repository changes",
  commitFrequency: "Commits per week average",
  recencyScore: "How recently the area was modified (0-100)",
  impactScore: "Magnitude of changes made (0-100)",
  contributorMomentum: "Growth in contributor participation (0-100)",
};

/**
 * Get activity level label and color
 */
export function getActivityLevelDisplay(score: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 75) {
    return {
      label: ACTIVITY_LEVEL_LABELS.critical,
      color: ACTIVITY_SCORE_COLORS.critical,
      icon: "🔴",
    };
  }
  if (score >= 50) {
    return {
      label: ACTIVITY_LEVEL_LABELS.high,
      color: ACTIVITY_SCORE_COLORS.high,
      icon: "🟠",
    };
  }
  if (score >= 25) {
    return {
      label: ACTIVITY_LEVEL_LABELS.moderate,
      color: ACTIVITY_SCORE_COLORS.moderate,
      icon: "🟡",
    };
  }
  return {
    label: ACTIVITY_LEVEL_LABELS.low,
    color: ACTIVITY_SCORE_COLORS.low,
    icon: "🟢",
  };
}

/**
 * Get velocity description and color
 */
export function getVelocityDisplay(velocity: string): {
  label: string;
  description: string;
  color: string;
  icon: string;
} {
  const desc = VELOCITY_DESCRIPTIONS[velocity as keyof typeof VELOCITY_DESCRIPTIONS] || "Unknown";
  let color: string = CHANGE_VELOCITY_COLORS.stable;
  let icon = "→";

  if (velocity === "accelerating") {
    color = CHANGE_VELOCITY_COLORS.accelerating;
    icon = "📈";
  } else if (velocity === "declining") {
    color = CHANGE_VELOCITY_COLORS.declining;
    icon = "📉";
  }

  return {
    label: velocity.charAt(0).toUpperCase() + velocity.slice(1),
    description: desc,
    color,
    icon,
  };
}

/**
 * Get health indicator description and color
 */
export function getHealthIndicatorDisplay(indicator: string): {
  label: string;
  description: string;
  color: string;
  icon: string;
} {
  const desc = HEALTH_INDICATORS[indicator as keyof typeof HEALTH_INDICATORS] || "Unknown status";
  let color = "#10b981";
  let icon = "✨";

  if (indicator === "thriving") {
    color = "#10b981";
    icon = "🚀";
  } else if (indicator === "active") {
    color = "#3b82f6";
    icon = "⚡";
  } else if (indicator === "stable") {
    color = "#f59e0b";
    icon = "⏳";
  } else if (indicator === "declining") {
    color = "#dc2626";
    icon = "⚠️";
  }

  return {
    label: indicator.charAt(0).toUpperCase() + indicator.slice(1),
    description: desc,
    color,
    icon,
  };
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Get recommendation color based on priority
 */
export function getRecommendationColor(priority: "high" | "medium" | "low"): string {
  return RECOMMENDATION_PRIORITY_COLORS[priority];
}

export const RECENT_ACTIVITY_CATEGORIES = [
  "Most Active Areas",
  "Emerging Focus",
  "Stable Maintenance",
  "Declining Activity",
  "Team Momentum",
] as const;

export const CONTRIBUTOR_METRICS = {
  veryActive: "Making regular contributions",
  active: "Regular contributor",
  moderate: "Occasional contributor",
  inactive: "Minimal recent activity",
};
