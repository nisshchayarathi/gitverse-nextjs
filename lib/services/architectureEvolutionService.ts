import prisma from "../prisma";

export class ArchitectureEvolutionService {
  async getEvolutionData(repositoryId: number) {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        commits: {
          orderBy: {
            committedAt: "desc",
          },
          take: 500,
          include: {
            fileChanges: true,
          },
        },
        files: true,
        contributors: true,
        languages: true,
      },
    });

    if (!repository) {
      throw new Error("Repository not found");
    }

    // Commit activity by month
    const commitTimeline = new Map<string, number>();

    repository.commits.forEach((commit) => {
      const date = new Date(commit.committedAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      commitTimeline.set(key, (commitTimeline.get(key) || 0) + 1);
    });

    // Coupling analysis
    const couplingMap = new Map<string, number>();

    repository.commits.forEach((commit) => {
      const changedFiles = commit.fileChanges.map((f) => f.path);

      for (let i = 0; i < changedFiles.length; i++) {
        for (let j = i + 1; j < changedFiles.length; j++) {
          const pair = [changedFiles[i], changedFiles[j]]
            .sort()
            .join("::");

          couplingMap.set(pair, (couplingMap.get(pair) || 0) + 1);
        }
      }
    });

    const hotspots = Array.from(couplingMap.entries())
      .map(([pair, count]) => ({
        pair,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Repository metrics
    const totalFiles = repository.files.length;

    const totalLines = repository.files.reduce(
      (sum, file) => sum + (file.lines || 0),
      0
    );

    const totalCommits = repository.commits.length;

    const totalContributors = repository.contributors.length;

    return {
      repository: {
        id: repository.id,
        name: repository.name,
        url: repository.url,
      },

      metrics: {
        totalFiles,
        totalLines,
        totalCommits,
        totalContributors,
      },

      timeline: Array.from(commitTimeline.entries()).map(
        ([month, commits]) => ({
          month,
          commits,
        })
      ),

      hotspots,

      languages: repository.languages,

      insights: [
        totalCommits > 300
          ? "Repository shows high development activity"
          : "Repository has moderate commit activity",

        hotspots.length > 5
          ? "Several files are frequently changed together indicating architectural coupling"
          : "Low coupling detected between repository modules",

        totalContributors > 5
          ? "Repository has healthy contributor distribution"
          : "Repository has limited contributor diversity",
      ],
    };
  }
}

export const architectureEvolutionService =
  new ArchitectureEvolutionService();