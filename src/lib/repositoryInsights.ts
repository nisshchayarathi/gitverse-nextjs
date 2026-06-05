export interface InsightMetric {
  title: string;
  value: string | number;
  description: string;
  icon?: "📊" | "📈" | "🎯" | "⚠️" | "🔥" | "💡";
  badge?: string;
  trend?: "up" | "down" | "stable";
}

export interface RepositorySummary {
  totalModules: number;
  totalConnections: number;
  totalHotspots: number;
  overallComplexity: "Low" | "Medium" | "High";
}

export function deriveRepositoryInsights(repositoryData: any): {
  insights: InsightMetric[];
  summary: RepositorySummary;
} {
  const files = repositoryData?.files || [];
  const commits = repositoryData?.commits || [];
  const contributors = repositoryData?.contributors || [];
  

  // Calculate module distribution
  const moduleMap = new Map<string, { files: number; size: number; changes: number }>();

  files.forEach((file: any) => {
    const parts = String(file.path || "").split("/");
    const moduleName = parts[0] || "root";

    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, { files: 0, size: 0, changes: 0 });
    }

    const current = moduleMap.get(moduleName)!;
    current.files += 1;
    current.size += file.size || 0;
  });

  // Count changes per module from commits
  commits.forEach((commit: any) => {
    const fileChanges = (commit.filesChanged || 0);
    if (fileChanges > 0) {
      commit.message?.split(" ").forEach((word: string) => {
        Object.keys(Object.fromEntries(moduleMap.entries())).forEach((module) => {
          if (word.toLowerCase().includes(module.toLowerCase())) {
            const current = moduleMap.get(module)!;
            current.changes += fileChanges / 10; // Normalize
          }
        });
      });
    }
  });

  // Find most active module (most changes)
  const mostActiveModule = Array.from(moduleMap.entries()).reduce(
    (prev, [name, data]) => (data.changes > prev[1].changes ? [name, data] : prev),
    ["unknown", { files: 0, size: 0, changes: 0 }]
  );

  // Find largest module (most size)
  const largestModule = Array.from(moduleMap.entries()).reduce(
    (prev, [name, data]) => (data.size > prev[1].size ? [name, data] : prev),
    ["unknown", { files: 0, size: 0, changes: 0 }]
  );

  // Most connected (most files)
  const mostConnectedModule = Array.from(moduleMap.entries()).reduce(
    (prev, [name, data]) => (data.files > prev[1].files ? [name, data] : prev),
    ["unknown", { files: 0, size: 0, changes: 0 }]
  );

  // Contribution hotspot (highest commit activity)
  const commitActivity = commits.length;
  const topContributor = contributors?.[0];

  // Overall complexity based on languages and file count
  const totalFiles = files.length;
  const overallComplexity =
    totalFiles > 500 ? "High" : totalFiles > 200 ? "Medium" : "Low";

  const insights: InsightMetric[] = [
    {
      title: "Most Active Module",
      value: mostActiveModule[0] as string,
      description: `${Math.round((mostActiveModule[1] as any).changes)} changes`,
      icon: "📈",
      badge: "Core",
    },
    {
      title: "Largest Module",
      value: largestModule[0] as string,
      description: `${Math.round(((largestModule[1] as any).size || 0) / 1024)} KB`,
      icon: "📊",
      badge: "Size",
    },
    {
      title: "Most Connected",
      value: mostConnectedModule[0] as string,
      description: `${(mostConnectedModule[1] as any).files} files`,
      icon: "🎯",
      badge: "Files",
    },
    {
      title: "Contribution Hotspot",
      value: topContributor?.name || "Unknown",
      description: `${topContributor?.commits || 0} commits`,
      icon: "🔥",
      badge: "Active",
    },
    {
      title: "Repository Activity",
      value: commitActivity,
      description: `${commits.length} total commits`,
      icon: "💡",
      trend: "up",
    },
  ];

  const summary: RepositorySummary = {
    totalModules: moduleMap.size,
    totalConnections: Math.min(files.length, 999), // Cap for display
    totalHotspots: Math.ceil(commits.length / 50),
    overallComplexity,
  };

  return { insights, summary };
}
