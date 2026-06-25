import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Language {
  name: string;
  percentage: number;
}

interface DetailedRepo {
  id: number;
  name: string;
  languages: Language[];
}

interface LanguageComparisonChartProps {
  repos: DetailedRepo[];
}

export function LanguageComparisonChart({ repos }: LanguageComparisonChartProps) {
  // Use sanitized repository name as series key to avoid collisions when names repeat
  const repoSeries = repos.map((repo) => ({
    key: `repo_${repo.name.replace(/\s+/g, "_").toLowerCase()}`,
    label: repo.name,
  }));

  // 1. Get all unique language names across all repositories
  const allLanguages = Array.from(
    new Set(repos.flatMap((repo) => repo.languages?.map((l) => l.name) || []))
  );

  // 2. Format data for Recharts
  // Shape: [{ language: 'TypeScript', [repoAName]: 80, [repoBName]: 50 }]
  const chartData = allLanguages
    .map((langName) => {
      const dataPoint: { [key: string]: string | number } = {
        language: langName,
      };

      repos.forEach((repo, idx) => {
        const langInfo = repo.languages?.find((l) => l.name === langName);
        dataPoint[repoSeries[idx].key] = langInfo ? Math.round(langInfo.percentage * 10) / 10 : 0;
      });

      return dataPoint;
    })
    // Sort by maximum percentage in any repo to put prominent languages first
    .sort((a, b) => {
      const maxA = Math.max(
        ...repoSeries.map((series) => (a[series.key] as number) || 0)
      );
      const maxB = Math.max(
        ...repoSeries.map((series) => (b[series.key] as number) || 0)
      );
      return maxB - maxA;
    })
    // Limit to top 8 languages to avoid crowding the chart
    .slice(0, 8);

  // Define colors for the repositories
  const colors = ["#6366f1", "#ec4899", "#10b981"]; // Indigo, Pink, Emerald

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass border border-border/50 rounded-xl p-3 shadow-xl space-y-1">
          <p className="text-xs font-bold text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold text-foreground">{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass border border-border/50 rounded-2xl p-6 relative overflow-hidden group hover:border-border hover:shadow-xl transition-all duration-300">
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="text-lg font-semibold text-foreground">Language Distribution</h3>
        <p className="text-xs text-muted-foreground">
          Side-by-side comparison of programming languages percentages (top 8).
        </p>
      </div>

      <div className="h-[300px] w-full mt-4">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No language distribution data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
              <XAxis
                dataKey="language"
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              />
              {repos.map((repo, idx) => (
                <Bar
                  key={repo.id}
                  dataKey={repoSeries[idx].key}
                  name={repoSeries[idx].label}
                  fill={colors[idx % colors.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
