"use client";

import { EvolutionMetrics } from "@/components/repository/EvolutionMetrics";
import { ArchitectureInsights } from "@/components/repository/ArchitectureInsights";
import { CouplingHotspots } from "@/components/repository/CouplingHotspots";
import { CommitActivityHeatmap } from "@/components/visualizations/CommitActivityHeatmap";
import { CodeDependencyGraph } from "@/components/visualizations/CodeDependencyGraph";

const mockData = {
  metrics: {
    totalCommits: 1248,
    contributors: 18,
    filesChanged: 342,
    architecturalDrift: "Low",
    dependencyGrowth: "+12%",
  },

  insights: [
    {
      title: "High Coupling Detected",
      description:
        "Authentication and repository modules are tightly coupled.",
      severity: "high",
    },
    {
      title: "Architecture Stable",
      description:
        "Core services remained stable across recent commits.",
      severity: "low",
    },
  ],

  hotspots: [
    {
      module: "auth",
      couplingScore: 92,
    },
    {
      module: "repository",
      couplingScore: 76,
    },
  ],

  commitActivity: [
    { day: "Mon", commits: 12 },
    { day: "Tue", commits: 18 },
    { day: "Wed", commits: 9 },
    { day: "Thu", commits: 22 },
    { day: "Fri", commits: 14 },
  ],

  dependencies: [
    { source: "auth", target: "repository" },
    { source: "repository", target: "analysis" },
    { source: "analysis", target: "ai" },
  ],
};

export default function AnalysisJobPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Repository Architecture Evolution
        </h1>

        <p className="text-muted-foreground mt-2">
          AI-powered repository analytics dashboard
        </p>
      </div>

      <EvolutionMetrics metrics={mockData.metrics} />

      <ArchitectureInsights insights={mockData.insights} />

      <CouplingHotspots
  hotspots={mockData.hotspots.map((item) => ({
    name: item.module,
    lines: item.couplingScore,
  }))}
/>

      <CommitActivityHeatmap repository={mockData} />

      <CodeDependencyGraph repository={mockData} />
    </div>
  );
}