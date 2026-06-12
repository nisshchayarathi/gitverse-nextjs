import { useState, useEffect } from "react";

export interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

export interface HeatmapData {
  totalContributions: number;
  weeks: { contributionDays: ContributionDay[] }[];
}

export function useGithubHeatmap(username: string | null) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setError(null);

    fetch(`/api/github/heatmap?username=${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load heatmap");
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  // Derived stats
  const days = data?.weeks.flatMap((w) => w.contributionDays) ?? [];
  const maxStreak = computeStreak(days);
  const last30Days = days.slice(-30).reduce((sum, d) => sum + d.contributionCount, 0);

  return { data, loading, error, maxStreak, last30Days };
}

function computeStreak(days: ContributionDay[]): number {
  let max = 0;
  let current = 0;
  for (const day of days) {
    if (day.contributionCount > 0) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}