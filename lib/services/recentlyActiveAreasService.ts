import prisma from "@/lib/prisma";

export interface ActivityArea {
  areaPath: string;
  activityScore: number;
  commitCount: number;
  lastUpdatedAt: Date;
  contributorCount: number;
  contributors: string[];
  filesChanged: number;
  additionsCount: number;
  deletionsCount: number;
}

function extractTopFolder(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : "root";
}

function calculateActivityScore(
  commitCount: number,
  daysSinceLastUpdate: number,
  contributorCount: number
): number {
  // Base score from commit count (weighted logarithmically, max 40)
  const commitScore = Math.min(40, Math.log10(Math.max(1, commitCount)) * 15);

  // Recency score: full 30 points if within 7 days, decays after (max 30)
  const recencyScore = Math.max(0, 30 - (daysSinceLastUpdate / 30) * 30);

  // Contributor diversity (max 30)
  const contributorScore = Math.min(30, contributorCount * 5);

  let score = commitScore + recencyScore + contributorScore;
  return Math.round(Math.min(100, score));
}

export async function analyzeRepositoryActivity(repositoryId: number): Promise<ActivityArea[]> {
  // Get recent commits (last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const commits = await prisma.commit.findMany({
    where: {
      repositoryId,
      committedAt: { gte: threeMonthsAgo },
    },
    include: {
      fileChanges: true,
    },
    orderBy: { committedAt: "desc" },
  });

  if (commits.length === 0) {
    return [];
  }

  // Group by folder
  const areaMap = new Map<string, {
    commits: Set<number>;
    files: Set<string>;
    contributors: Set<string>;
    lastUpdated: Date;
    additions: number;
    deletions: number;
  }>();

  const now = new Date();

  for (const commit of commits) {
    for (const change of commit.fileChanges) {
      const area = extractTopFolder(change.path);
      if (!areaMap.has(area)) {
        areaMap.set(area, {
          commits: new Set(),
          files: new Set(),
          contributors: new Set(),
          lastUpdated: commit.committedAt,
          additions: 0,
          deletions: 0,
        });
      }
      const data = areaMap.get(area)!;
      data.commits.add(commit.id);
      data.files.add(change.path);
      data.contributors.add(commit.authorName);
      if (commit.committedAt > data.lastUpdated) {
        data.lastUpdated = commit.committedAt;
      }
      data.additions += change.additions;
      data.deletions += change.deletions;
    }
  }

  // Convert to ActivityArea array and calculate scores
  const areas: ActivityArea[] = [];
  for (const [areaPath, data] of areaMap) {
    const daysSinceUpdate = Math.max(0, (now.getTime() - data.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    const activityScore = calculateActivityScore(data.commits.size, daysSinceUpdate, data.contributors.size);

    areas.push({
      areaPath,
      activityScore,
      commitCount: data.commits.size,
      lastUpdatedAt: data.lastUpdated,
      contributorCount: data.contributors.size,
      contributors: Array.from(data.contributors),
      filesChanged: data.files.size,
      additionsCount: data.additions,
      deletionsCount: data.deletions,
    });
  }

  // Sort by activity score descending
  areas.sort((a, b) => b.activityScore - a.activityScore);

  return areas;
}

export async function saveActivityAreas(repositoryId: number, areas: ActivityArea[]) {
  // Delete old records
  await prisma.repositoryActivityArea.deleteMany({ where: { repositoryId } });

  // Insert new records
  for (const area of areas) {
    await prisma.repositoryActivityArea.create({
      data: {
        repositoryId,
        areaPath: area.areaPath,
        activityScore: area.activityScore,
        commitCount: area.commitCount,
        lastUpdatedAt: area.lastUpdatedAt,
        contributorCount: area.contributorCount,
        contributors: area.contributors,
        filesChanged: area.filesChanged,
        additionsCount: area.additionsCount,
        deletionsCount: area.deletionsCount,
      },
    });
  }
}

export async function getRecentlyActiveAreas(repositoryId: number, limit = 10): Promise<ActivityArea[]> {
  const records = await prisma.repositoryActivityArea.findMany({
    where: { repositoryId },
    orderBy: { activityScore: "desc" },
    take: limit,
  });

  return records.map((r) => ({
    areaPath: r.areaPath,
    activityScore: r.activityScore,
    commitCount: r.commitCount,
    lastUpdatedAt: r.lastUpdatedAt,
    contributorCount: r.contributorCount,
    contributors: r.contributors,
    filesChanged: r.filesChanged,
    additionsCount: r.additionsCount,
    deletionsCount: r.deletionsCount,
  }));
}

export default { analyzeRepositoryActivity, saveActivityAreas, getRecentlyActiveAreas };
