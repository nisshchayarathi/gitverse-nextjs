"use client";

import { Card } from "@/components/ui";

interface Props {
  metrics: {
    totalCommits?: number;
    totalFiles?: number;
    totalContributors?: number;
    languageCount?: number;
  };
}

export function EvolutionMetrics({ metrics }: Props) {
  const items = [
    {
      label: "Commits",
      value: metrics?.totalCommits ?? 0,
    },
    {
      label: "Files",
      value: metrics?.totalFiles ?? 0,
    },
    {
      label: "Contributors",
      value: metrics?.totalContributors ?? 0,
    },
    {
      label: "Languages",
      value: metrics?.languageCount ?? 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="p-6">
          <div className="text-3xl font-bold">
            {item.value}
          </div>

          <div className="text-sm text-muted-foreground mt-2">
            {item.label}
          </div>
        </Card>
      ))}
    </div>
  );
}