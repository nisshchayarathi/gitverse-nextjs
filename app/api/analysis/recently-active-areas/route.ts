/**
 * Recently Active Areas API Route
 * Handles analyzing and retrieving activity data
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface ActivityAnalysisRequest {
  repositoryId: string;
  timeWindow: "week" | "twoWeeks" | "month" | "quarter";
  maxAreasToShow?: number;
}

/**
 * POST - Analyze recent activity in a repository
 */
export async function POST(request: NextRequest) {
  try {
    const body: ActivityAnalysisRequest = await request.json();

    if (!body.repositoryId) {
      return NextResponse.json(
        { success: false, message: "Missing required field: repositoryId" },
        { status: 400 }
      );
    }

    const timeWindow = body.timeWindow || "month";
    const maxAreas = body.maxAreasToShow || 10;

    // In a real implementation, would analyze actual git history
    // For now, returning mock analysis
    const analysis = generateMockAnalysis(body.repositoryId, timeWindow, maxAreas);

    return NextResponse.json(
      {
        success: true,
        data: analysis,
        message: "Activity analysis completed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error analyzing activity:", error);
    return NextResponse.json(
      { success: false, message: "Failed to analyze activity" },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve cached activity analysis
 * Query params:
 * - repositoryId: ID of repository
 * - timeWindow: week, twoWeeks, month, or quarter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const repositoryId = searchParams.get("repositoryId");
    const timeWindow = (searchParams.get("timeWindow") || "month") as
      | "week"
      | "twoWeeks"
      | "month"
      | "quarter";

    if (!repositoryId) {
      return NextResponse.json(
        { success: false, message: "Missing required query parameter: repositoryId" },
        { status: 400 }
      );
    }

    const analysis = generateMockAnalysis(repositoryId, timeWindow, 10);

    return NextResponse.json(
      {
        success: true,
        data: analysis,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrieving activity:", error);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve activity" },
      { status: 500 }
    );
  }
}

/**
 * Generates mock activity analysis
 */
function generateMockAnalysis(
  repositoryId: string,
  timeWindow: string,
  maxAreas: number
) {
  const windowDays =
    timeWindow === "week"
      ? 7
      : timeWindow === "twoWeeks"
      ? 14
      : timeWindow === "quarter"
      ? 90
      : 30;

  const now = new Date();

  const areaNames = [
    "Authentication",
    "API Routes",
    "Database Models",
    "UI Components",
    "Services",
    "Utilities",
    "Configuration",
  ];

  const topActiveAreas = areaNames.slice(0, maxAreas).map((name, index) => ({
    id: `area-${index}`,
    path: `src/${name.toLowerCase()}`,
    name,
    type: index % 3 === 0 ? "service" : index % 3 === 1 ? "component" : "module",
    activityScore: 100 - index * 15,
    lastUpdated: new Date(now.getTime() - Math.random() * windowDays * 24 * 60 * 60 * 1000),
    lastUpdatedFormatted: `${Math.floor(Math.random() * 7)} days ago`,
    commitsInPeriod: Math.floor(Math.random() * 30) + 5,
    uniqueContributors: Math.floor(Math.random() * 5) + 1,
    totalFilesChanged: Math.floor(Math.random() * 50) + 5,
    filesModified: Math.floor(Math.random() * 40) + 3,
    filesAdded: Math.floor(Math.random() * 10) + 1,
    filesRemoved: Math.floor(Math.random() * 5),
    totalInsertions: Math.floor(Math.random() * 1000) + 100,
    totalDeletions: Math.floor(Math.random() * 500) + 50,
    commitFrequency: Math.random() * 3 + 0.5,
    recencyScore: 100 - index * 10,
    impactScore: Math.random() * 100,
    contributorMomentum: Math.random() * 100,
    relatedAreas: [areaNames[(index + 1) % areaNames.length]],
    recentCommits: [],
    changeVelocity:
      index % 3 === 0
        ? ("accelerating" as const)
        : index % 3 === 1
        ? ("stable" as const)
        : ("declining" as const),
  }));

  return {
    repositoryId,
    analysisDate: now.toISOString(),
    timeWindow,
    windowDays,
    totalCommits: Math.floor(Math.random() * 100) + 20,
    uniqueContributors: Math.floor(Math.random() * 8) + 2,
    affectedAreas: areaNames.length,
    topActiveAreas,
    activityTrends: generateMockTrends(windowDays),
    hotspots: topActiveAreas.slice(0, 3).map((area) => ({
      path: area.path,
      name: area.name,
      activityLevel: area.activityScore > 75 ? "critical" : "high",
      commitCount: area.commitsInPeriod,
      contributors: Array(area.uniqueContributors)
        .fill(0)
        .map((_, i) => `Dev${i + 1}`),
      lastCommitDate: area.lastUpdated,
      suggestionForContributors:
        area.activityScore > 75
          ? "High activity detected. Great place to contribute!"
          : "Moderate activity. Good area for learning.",
    })),
    recommendations: [
      {
        title: "Focus on High-Activity Areas",
        description: `${topActiveAreas[0].name} is the most active area.`,
        targetArea: topActiveAreas[0].path,
        priority: "high",
        action: "Review recent changes and consider contributions",
        estimatedImpact: "Direct contribution impact",
      },
      {
        title: "Explore Emerging Focus",
        description: "Activity is accelerating in the UI Components area.",
        targetArea: "src/components",
        priority: "high",
        action: "Get involved in actively growing area",
        estimatedImpact: "Build expertise early",
      },
    ],
  };
}

/**
 * Generates mock activity trends
 */
function generateMockTrends(windowDays: number) {
  const weeksCount = Math.ceil(windowDays / 7);
  const trends = [];

  for (let i = 0; i < weeksCount; i++) {
    trends.push({
      period: `Week ${i + 1}`,
      totalCommits: Math.floor(Math.random() * 30) + 5,
      activeAreas: Math.floor(Math.random() * 5) + 2,
      averageActivityScore: Math.random() * 100,
      topContributors: Math.floor(Math.random() * 4) + 1,
      changedFiles: Math.floor(Math.random() * 50) + 10,
    });
  }

  return trends;
}
