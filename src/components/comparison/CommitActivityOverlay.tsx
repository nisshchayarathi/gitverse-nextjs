import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GitCommit } from "lucide-react";

interface Commit {
  committedAt: string;
}

interface DetailedRepo {
  id: number;
  name: string;
  commits: Commit[];
}

interface CommitActivityOverlayProps {
  repos: DetailedRepo[];
}

export function CommitActivityOverlay({ repos }: CommitActivityOverlayProps) {
  const repoSeries = repos.map((repo) => ({
    key: `repo_${repo.id}`,
    label: repo.name,
  }));

  // 1. Generate weekly buckets for the last 3 months (12 weeks)
  const getWeekBuckets = () => {
    const buckets = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const label = weekStart.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

      buckets.push({
        start: weekStart,
        end: weekEnd,
        label,
      });
    }
    return buckets;
  };

  const buckets = getWeekBuckets();

  // 2. Count commits falling into each week bucket for each repo
  const chartData = buckets.map((bucket) => {
    const dataPoint: { [key: string]: string | number } = {
      week: bucket.label,
    };

    repos.forEach((repo, idx) => {
      const count =
        repo.commits?.filter((commit) => {
          const commitDate = new Date(commit.committedAt);
          return commitDate >= bucket.start && commitDate <= bucket.end;
        }).length || 0;

      dataPoint[repoSeries[idx].key] = count;
    });

    return dataPoint;
  });

  const colors = ["#6366f1", "#ec4899", "#10b981"]; // Indigo, Pink, Emerald

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass border border-border/50 rounded-xl p-3 shadow-xl space-y-1">
          <p className="text-xs font-bold text-foreground mb-1">Week of {label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold text-foreground">{entry.value} commits</span>
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
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GitCommit className="h-5 w-5 text-primary" />
          Recent Commit Activity
        </h3>
        <p className="text-xs text-muted-foreground">
          Overlaid weekly commit counts comparison over the last 3 months.
        </p>
      </div>

      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
            <XAxis
              dataKey="week"
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
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            />
            {repos.map((repo, idx) => (
              <Line
                key={repo.id}
                type="monotone"
                dataKey={repoSeries[idx].key}
                name={repoSeries[idx].label}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
