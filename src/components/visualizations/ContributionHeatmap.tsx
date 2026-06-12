"use client";

import { useState } from "react";
import { useGithubHeatmap, ContributionDay } from "@/hooks/useGithubHeatmap";

interface Props {
  username: string;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ContributionHeatmap({ username }: Props) {
  const { data, loading, error, maxStreak, last30Days } = useGithubHeatmap(username);
  const [tooltip, setTooltip] = useState<{ day: ContributionDay; x: number; y: number } | null>(null);

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl bg-gray-800 h-40 w-full" />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/20 border border-red-700 p-4 text-red-400 text-sm">
        Could not load contribution data: {error}
      </div>
    );
  }

  if (!data) return null;

  const weeks = data.weeks;

  // Build month label positions
  const monthPositions: { label: string; col: number }[] = [];
  weeks.forEach((week, i) => {
    const firstDay = week.contributionDays[0];
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      const prev = i > 0 ? new Date(weeks[i - 1].contributionDays[0]?.date).getMonth() : -1;
      if (month !== prev) {
        monthPositions.push({ label: MONTH_LABELS[month], col: i });
      }
    }
  });

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700 p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-base">
          Contribution Activity
        </h3>
        <span className="text-gray-400 text-sm">
          {data.totalContributions.toLocaleString()} contributions this year
        </span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-5">
        <div className="flex-1 rounded-lg bg-gray-800 p-3 text-center">
          <div className="text-green-400 font-bold text-xl">{data.totalContributions.toLocaleString()}</div>
          <div className="text-gray-400 text-xs mt-1">Total this year</div>
        </div>
        <div className="flex-1 rounded-lg bg-gray-800 p-3 text-center">
          <div className="text-blue-400 font-bold text-xl">{maxStreak}</div>
          <div className="text-gray-400 text-xs mt-1">Longest streak</div>
        </div>
        <div className="flex-1 rounded-lg bg-gray-800 p-3 text-center">
          <div className="text-purple-400 font-bold text-xl">{last30Days}</div>
          <div className="text-gray-400 text-xs mt-1">Last 30 days</div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="relative inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-1" style={{ gap: "2px" }}>
            {weeks.map((_, i) => {
              const mp = monthPositions.find((m) => m.col === i);
              return (
                <div key={i} style={{ width: 12, minWidth: 12 }} className="text-[9px] text-gray-500 text-center">
                  {mp?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* Day grid */}
          <div className="flex" style={{ gap: "2px" }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: "2px" }}>
                {week.contributionDays.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: day.contributionCount === 0 ? "#161b22" : day.color,
                      borderRadius: 2,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ day, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-gray-500 text-xs mr-1">Less</span>
            {["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"].map((c) => (
              <div key={c} style={{ width: 10, height: 10, backgroundColor: c, borderRadius: 2 }} />
            ))}
            <span className="text-gray-500 text-xs ml-1">More</span>
          </div>
        </div>
      </div>

      {/* Tooltip (fixed overlay) */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white pointer-events-none shadow-xl"
          style={{ top: tooltip.y - 50, left: tooltip.x - 60 }}
        >
          <div className="font-semibold text-green-400">
            {tooltip.day.contributionCount} contribution{tooltip.day.contributionCount !== 1 ? "s" : ""}
          </div>
          <div className="text-gray-300 mt-0.5">
            {new Date(tooltip.day.date).toLocaleDateString("en-US", {
              weekday: "short", year: "numeric", month: "short", day: "numeric",
            })}
          </div>
        </div>
      )}
    </div>
  );
}